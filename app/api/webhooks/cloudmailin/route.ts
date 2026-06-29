import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { parseLeadEmail } from "@/lib/lead-parser";
import { ingestParsedLead } from "@/lib/lead-service";

interface CloudmailinInbound {
  headers: {
    subject?: string;
    from?: string;
    to?: string;
  };
  envelope: {
    to: string;
    from: string;
    recipients: string[];
  };
  plain?: string;
  html?: string;
}

/**
 * Inbound email parsing webhook (Cloudmailin).
 *
 * Security: Cloudmailin inbound is secured by configuring a secret in the webhook
 * URL — we additionally require ?token=<POSTMARK_WEBHOOK_TOKEN>.
 * (Using the same env var so we don't need to add a new one right now).
 *
 * Broker routing: each broker has a unique inbound address
 * hash+<broker.webhookToken>@cloudmailin.net, so the "+token" part
 * tells us which broker the lead belongs to.
 */
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.POSTMARK_WEBHOOK_TOKEN;
    const token = request.nextUrl.searchParams.get("token");
    if (!expected || token !== expected) {
      return jsonError("Unauthorized", 401);
    }

    const body = (await request.json()) as CloudmailinInbound;

    // Cloudmailin Normal JSON format
    const toAddress = body.envelope?.to || body.headers?.to || "";
    
    // Extract the token after the '+' and before the '@'
    const match = toAddress.match(/\+([^@]+)@/);
    const mailboxHash = match ? match[1] : "";

    if (!mailboxHash) {
      return jsonError("Could not determine broker from recipient address. Ensure you are forwarding to address+token@cloudmailin.net", 422);
    }

    const broker = await prisma.broker.findFirst({
      where: { webhookToken: mailboxHash },
    });
    if (!broker) return jsonError("Unknown broker mailbox", 404);

    const parsed = parseLeadEmail({
      subject: body.headers?.subject ?? "",
      textBody: body.plain ?? "",
      htmlBody: body.html,
      fromEmail: body.envelope?.from ?? body.headers?.from ?? "",
    });

    if (!parsed) {
      // Auto-confirm Gmail forwarding verification emails.
      const isGmailConfirmation =
        body.headers?.subject?.includes("Forwarding Confirmation") ||
        body.envelope?.from?.includes("forwarding-noreply@google.com");

      if (isGmailConfirmation && body.plain) {
        // Return the whole email text so the user can read the confirmation code
        return jsonError(`GMAIL EMAIL BODY: ${body.plain}`, 422);
      }

      return jsonError("Could not extract a valid lead from email", 422);
    }

    const result = await ingestParsedLead(broker.id, parsed);
    return jsonOk(result, result.duplicate ? 200 : 201);
  } catch (err) {
    console.error("cloudmailin webhook error:", err);
    return jsonError("Internal server error", 500);
  }
}
