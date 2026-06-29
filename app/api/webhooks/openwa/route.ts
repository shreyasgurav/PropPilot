import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWebhookMessage } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/utils";
import {
  notifyBrokerOfReply,
  recordInbound,
  type LeadWithRelations,
} from "@/lib/messaging";
import { cancelFollowUps } from "@/lib/jobs";
import { LeadStatus } from "@prisma/client";

/**
 * OpenWA inbound webhook.
 *
 * OpenWA sends POST requests here when a message is received on any
 * broker's linked WhatsApp session. The payload format is:
 *
 * {
 *   "event": "message.received",
 *   "sessionId": "sess_...",
 *   "data": { from, body, type, id, timestamp, fromMe, notifyName }
 * }
 *
 * On an inbound prospect message we:
 *   1. Identify the broker by sessionId
 *   2. Find the matching lead by phone number
 *   3. Record the inbound message on the lead timeline
 *   4. Cancel all pending automated follow-ups (a human takes over)
 *   5. Move the lead to INTERESTED
 *   6. Notify the broker on their own WhatsApp
 *
 * We always return 200 quickly — non-200 makes OpenWA retry.
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: verify HMAC signature from OpenWA.
    // For now we trust the request since the URL contains a secret token.
    const token = request.nextUrl.searchParams.get("token");
    const expected = process.env.OPENWA_WEBHOOK_SECRET;
    if (expected && token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const inbound = parseWebhookMessage(body);

    // Status update or unparseable — ack and move on.
    if (!inbound) {
      return NextResponse.json({ ignored: true }, { status: 200 });
    }

    // Identify the broker by which OpenWA session received the message.
    const broker = await prisma.broker.findFirst({
      where: { openwaSessionId: inbound.sessionId },
      select: { id: true },
    });
    if (!broker) {
      console.warn(
        "Inbound WhatsApp for unknown sessionId:",
        inbound.sessionId,
      );
      return NextResponse.json({ matched: false }, { status: 200 });
    }

    const phone = normalizePhone(inbound.from);
    if (!phone) {
      return NextResponse.json({ matched: false }, { status: 200 });
    }

    const lead = await prisma.lead.findFirst({
      where: { phone, brokerId: broker.id },
      include: { broker: true, property: true },
      orderBy: { createdAt: "desc" },
    });

    if (!lead) {
      console.warn("Inbound WhatsApp from unknown number:", phone);
      return NextResponse.json({ matched: false }, { status: 200 });
    }

    const text = inbound.text ?? `[${inbound.type} message]`;

    await recordInbound(lead.id, text);

    await cancelFollowUps(lead.id).catch((e) =>
      console.error("cancelFollowUps failed on inbound:", e),
    );

    // Only advance status if the lead hasn't already progressed further.
    const earlyStatuses: LeadStatus[] = [LeadStatus.NEW, LeadStatus.CONTACTED];
    if (earlyStatuses.includes(lead.status)) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.INTERESTED },
      });
    }

    await notifyBrokerOfReply(lead as LeadWithRelations, text);

    return NextResponse.json(
      { matched: true, leadId: lead.id },
      { status: 200 },
    );
  } catch (err) {
    console.error("openwa webhook error:", err);
    // Still 200 so OpenWA does not retry and duplicate-process.
    return NextResponse.json({ error: "handled" }, { status: 200 });
  }
}
