import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { parseLeadEmail } from "@/lib/lead-parser";
import { ingestParsedLead } from "@/lib/lead-service";

interface PostmarkAddress {
  Email: string;
  Name?: string;
  MailboxHash?: string;
}

interface PostmarkInbound {
  FromFull?: PostmarkAddress;
  From?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  ToFull?: PostmarkAddress[];
  OriginalRecipient?: string;
  MailboxHash?: string;
}

/**
 * Inbound email parsing webhook (Postmark).
 *
 * Security: Postmark inbound is secured by configuring a secret in the webhook
 * URL — we additionally require ?token=<POSTMARK_WEBHOOK_TOKEN>.
 *
 * Broker routing: each broker has a unique inbound address
 * leads+<broker.webhookToken>@inbound.brokerpulse.app, so the "+hash" part
 * (MailboxHash) tells us which broker the lead belongs to.
 */
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.POSTMARK_WEBHOOK_TOKEN;
    const token = request.nextUrl.searchParams.get("token");
    if (!expected || token !== expected) {
      return jsonError("Unauthorized", 401);
    }

    const body = (await request.json()) as PostmarkInbound;

    const mailboxHash =
      body.MailboxHash ||
      body.ToFull?.find((t) => t.MailboxHash)?.MailboxHash ||
      "";

    if (!mailboxHash) {
      return jsonError("Could not determine broker from recipient address", 422);
    }

    const broker = await prisma.broker.findFirst({
      where: { webhookToken: mailboxHash },
    });
    if (!broker) return jsonError("Unknown broker mailbox", 404);

    const parsed = parseLeadEmail({
      subject: body.Subject ?? "",
      textBody: body.TextBody ?? "",
      htmlBody: body.HtmlBody,
      fromEmail: body.FromFull?.Email ?? body.From ?? "",
    });

    if (!parsed) {
      return jsonError("Could not extract a valid lead from email", 422);
    }

    const result = await ingestParsedLead(broker.id, parsed);
    return jsonOk(result, result.duplicate ? 200 : 201);
  } catch (err) {
    console.error("postmark webhook error:", err);
    return jsonError("Internal server error", 500);
  }
}
