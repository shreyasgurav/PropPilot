import { type NextRequest } from "next/server";
import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { sendManualMessageSchema } from "@/lib/validation";
import { sendToProspect, type LeadWithRelations } from "@/lib/messaging";

interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const broker = await requireBroker();

    const lead = await prisma.lead.findFirst({
      where: { id: params.id, brokerId: broker.id },
      include: { broker: true, property: true },
    });
    if (!lead) return jsonError("Lead not found", 404);

    const body = await request.json();
    const { content } = sendManualMessageSchema.parse(body);

    const result = await sendToProspect(lead as LeadWithRelations, content);
    if (!result.ok) {
      return jsonError(result.error ?? "Failed to send WhatsApp message", 502);
    }

    return jsonOk({ sent: true });
  } catch (err) {
    return handleApiError(err);
  }
}
