import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  markMessageRead,
  parseWebhookMessage,
  verifyWebhook,
} from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/utils";
import {
  notifyBrokerOfReply,
  recordInbound,
  type LeadWithRelations,
} from "@/lib/messaging";
import { cancelFollowUps } from "@/lib/jobs";
import { LeadStatus } from "@prisma/client";

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * GET  — subscription verification handshake (Meta calls this once on setup).
 * POST — inbound events: prospect messages + delivery/read status updates.
 *
 * On an inbound prospect message we:
 *   1. record the inbound message on the matching lead
 *   2. cancel all pending automated follow-ups (a human takes over)
 *   3. move the lead to INTERESTED
 *   4. notify the broker on their own WhatsApp
 *   5. mark the prospect's message as read
 *
 * We always return 200 quickly — non-200 makes Meta retry and duplicate work.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const challenge = verifyWebhook(
    params.get("hub.mode"),
    params.get("hub.verify_token"),
    params.get("hub.challenge"),
  );

  if (challenge === null) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const inbound = parseWebhookMessage(body);

    // Status update (delivered/read) or unparseable — ack and move on.
    if (!inbound) {
      return NextResponse.json({ ignored: true }, { status: 200 });
    }

    // Identify the broker by which business number received the message.
    const broker = await prisma.broker.findFirst({
      where: { metaPhoneNumberId: inbound.phoneNumberId },
      select: { id: true },
    });
    if (!broker) {
      console.warn(
        "Inbound WhatsApp for unknown phoneNumberId:",
        inbound.phoneNumberId,
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

    // Best-effort read receipt.
    await markMessageRead(inbound.phoneNumberId, inbound.messageId);

    return NextResponse.json(
      { matched: true, leadId: lead.id },
      { status: 200 },
    );
  } catch (err) {
    console.error("meta webhook error:", err);
    // Still 200 so Meta does not retry and duplicate-process.
    return NextResponse.json({ error: "handled" }, { status: 200 });
  }
}
