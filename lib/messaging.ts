import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/wati";
import { brokerReplyNotification, type TemplateContext } from "@/lib/whatsapp-templates";
import { MessageDirection } from "@prisma/client";
import type { Broker, Lead, Property } from "@prisma/client";

export type LeadWithRelations = Lead & {
  broker: Broker;
  property: Property | null;
};

export function buildTemplateContext(lead: LeadWithRelations): TemplateContext {
  return {
    prospectName: lead.name,
    brokerName: lead.broker.name,
    propertyTitle: lead.property?.title ?? "the property you enquired about",
    location: lead.property?.location ?? "Mumbai",
    price: lead.property?.price ?? "",
  };
}

/**
 * Send a WhatsApp message to the prospect and record it on the lead timeline.
 * Records a 'failed' Message row (and returns ok:false) when WATI errors so the
 * failure is visible in the UI and can be retried.
 */
export async function sendToProspect(
  lead: LeadWithRelations,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendMessage(lead.phone, content);

  await prisma.message.create({
    data: {
      leadId: lead.id,
      direction: MessageDirection.OUTBOUND,
      content,
      status: result.ok ? "sent" : "failed",
    },
  });

  if (result.ok) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContactedAt: new Date() },
    });
  }

  return { ok: result.ok, error: result.error };
}

/**
 * Record an inbound message from the prospect.
 */
export async function recordInbound(leadId: string, content: string): Promise<void> {
  await prisma.message.create({
    data: {
      leadId,
      direction: MessageDirection.INBOUND,
      content,
    },
  });
}

/**
 * Notify the broker (on their own WhatsApp) that a prospect has replied.
 * Best-effort: failures are logged but never throw.
 */
export async function notifyBrokerOfReply(
  lead: LeadWithRelations,
  reply: string,
): Promise<void> {
  try {
    const message = brokerReplyNotification({
      prospectName: lead.name,
      prospectPhone: lead.phone,
      propertyTitle: lead.property?.title ?? "a property",
      reply,
    });
    await sendMessage(lead.broker.phone, message);
  } catch (err) {
    console.error("notifyBrokerOfReply failed:", err);
  }
}

/**
 * Returns true if we have already sent an outbound message to this lead today.
 * Enforces the "max 1 WhatsApp per lead per day" rule.
 */
export async function hasContactedToday(leadId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const count = await prisma.message.count({
    where: {
      leadId,
      direction: MessageDirection.OUTBOUND,
      status: "sent",
      sentAt: { gte: startOfDay },
    },
  });

  return count > 0;
}
