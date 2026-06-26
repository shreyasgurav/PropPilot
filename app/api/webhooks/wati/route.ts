import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { parseWatiInbound, type WatiInboundPayload } from "@/lib/wati";
import { normalizePhone } from "@/lib/utils";
import {
  notifyBrokerOfReply,
  recordInbound,
  type LeadWithRelations,
} from "@/lib/messaging";
import { cancelFollowUps } from "@/lib/jobs";
import { LeadStatus } from "@prisma/client";

/**
 * Inbound WhatsApp reply from a prospect (WATI webhook).
 *
 * When a prospect replies we:
 *   1. record the inbound message on their lead
 *   2. cancel all pending automated follow-ups (a human takes over now)
 *   3. move the lead to INTERESTED
 *   4. notify the broker on their own WhatsApp
 *
 * Optional ?token=<broker.webhookToken> scopes the lookup to one broker when
 * multiple brokers share a prospect phone number.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WatiInboundPayload;
    const inbound = parseWatiInbound(body);
    if (!inbound) {
      // Not an actionable inbound text (e.g. our own outbound echo).
      return jsonOk({ ignored: true });
    }

    const phone = normalizePhone(inbound.waId);
    if (!phone) return jsonError("Unrecognized phone format", 422);

    const token = request.nextUrl.searchParams.get("token");
    let brokerId: string | undefined;
    if (token) {
      const broker = await prisma.broker.findFirst({
        where: { webhookToken: token },
        select: { id: true },
      });
      brokerId = broker?.id;
    }

    const lead = await prisma.lead.findFirst({
      where: {
        phone,
        ...(brokerId ? { brokerId } : {}),
      },
      include: { broker: true, property: true },
      orderBy: { createdAt: "desc" },
    });

    if (!lead) {
      // No matching lead — nothing to attribute the reply to.
      return jsonOk({ matched: false });
    }

    await recordInbound(lead.id, inbound.text);

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

    await notifyBrokerOfReply(lead as LeadWithRelations, inbound.text);

    return jsonOk({ matched: true, leadId: lead.id });
  } catch (err) {
    console.error("wati webhook error:", err);
    return jsonError("Internal server error", 500);
  }
}
