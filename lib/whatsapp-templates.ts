/**
 * WhatsApp message templates for BrokerPulse.
 *
 * Each builder takes a typed context and returns the final message string.
 * Keep these in one place so copy can be tuned without touching business logic.
 */

export interface TemplateContext {
  prospectName: string;
  brokerName: string;
  propertyTitle: string;
  location: string;
  price: string;
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

export function initialMessage(ctx: TemplateContext): string {
  return (
    `Hi ${firstName(ctx.prospectName)}, thanks for your interest in ${ctx.propertyTitle} in ${ctx.location} (${ctx.price}). ` +
    `I'm ${ctx.brokerName}, your property consultant. ` +
    `When would be a good time for a quick call or site visit? ` +
    `I can also send you more photos right now if you'd like.`
  );
}

export function day1Followup(ctx: TemplateContext): string {
  return (
    `Hi ${firstName(ctx.prospectName)}, just checking if you had any questions about the ${ctx.propertyTitle} property? ` +
    `Happy to arrange a site visit at your convenience.`
  );
}

export function day3Followup(ctx: TemplateContext): string {
  return (
    `Hi ${firstName(ctx.prospectName)}, we have a site visit scheduled this weekend if you'd like to join. ` +
    `Only a few slots available. Would Sunday work for you?`
  );
}

export function day7Followup(ctx: TemplateContext): string {
  return (
    `Hi ${firstName(ctx.prospectName)}, sharing a few similar properties in your budget in case ${ctx.propertyTitle} didn't work out. ` +
    `Let me know if any of these interest you and I'll share full details.`
  );
}

/**
 * Notification sent to the broker (not the prospect) when a prospect replies.
 */
export function brokerReplyNotification(args: {
  prospectName: string;
  prospectPhone: string;
  propertyTitle: string;
  reply: string;
}): string {
  return (
    `🔔 ${args.prospectName} (${args.prospectPhone}) just replied about ${args.propertyTitle}:\n\n` +
    `"${args.reply}"\n\n` +
    `Open BrokerPulse to take over the conversation.`
  );
}

export type FollowUpDay = 1 | 3 | 7;

export function followupForDay(day: FollowUpDay, ctx: TemplateContext): string {
  switch (day) {
    case 1:
      return day1Followup(ctx);
    case 3:
      return day3Followup(ctx);
    case 7:
      return day7Followup(ctx);
    default: {
      // Exhaustiveness guard.
      const _never: never = day;
      throw new Error(`Unsupported follow-up day: ${_never as number}`);
    }
  }
}
