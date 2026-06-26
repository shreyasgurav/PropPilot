import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { parseLeadWebhook } from "@/lib/lead-parser";
import { ingestParsedLead } from "@/lib/lead-service";
import { LeadSource } from "@prisma/client";

/**
 * Direct lead webhook from MagicBricks (or a manual integration / Zapier).
 * Authenticated by ?token=<broker.webhookToken>.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) return jsonError("Missing token", 401);

    const broker = await prisma.broker.findFirst({ where: { webhookToken: token } });
    if (!broker) return jsonError("Invalid token", 401);

    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = parseLeadWebhook(payload, LeadSource.MAGICBRICKS);
    if (!parsed) return jsonError("Could not extract a valid phone from payload", 422);

    const result = await ingestParsedLead(broker.id, parsed);
    return jsonOk(result, result.duplicate ? 200 : 201);
  } catch (err) {
    console.error("magicbricks webhook error:", err);
    return jsonError("Internal server error", 500);
  }
}
