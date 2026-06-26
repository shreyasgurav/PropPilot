import { type NextRequest } from "next/server";
import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { updateLeadSchema } from "@/lib/validation";
import { cancelFollowUps } from "@/lib/jobs";
import { LeadStatus } from "@prisma/client";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const broker = await requireBroker();
    const lead = await prisma.lead.findFirst({
      where: { id: params.id, brokerId: broker.id },
      include: {
        property: true,
        messages: { orderBy: { sentAt: "asc" } },
        followUpJobs: { orderBy: { scheduledAt: "asc" } },
      },
    });

    if (!lead) return jsonError("Lead not found", 404);
    return jsonOk(lead);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const broker = await requireBroker();

    const existing = await prisma.lead.findFirst({
      where: { id: params.id, brokerId: broker.id },
      select: { id: true },
    });
    if (!existing) return jsonError("Lead not found", 404);

    const body = await request.json();
    const input = updateLeadSchema.parse(body);

    // If the property is being changed, ensure it belongs to this broker.
    if (input.propertyId) {
      const owned = await prisma.property.findFirst({
        where: { id: input.propertyId, brokerId: broker.id },
        select: { id: true },
      });
      if (!owned) return jsonError("Property not found", 422);
    }

    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: {
        status: input.status,
        notes: input.notes,
        budget: input.budget,
        propertyId: input.propertyId,
      },
      include: { property: true },
    });

    // Stop nurturing once the deal is resolved.
    if (
      input.status === LeadStatus.CLOSED ||
      input.status === LeadStatus.LOST
    ) {
      await cancelFollowUps(lead.id).catch((e) =>
        console.error("cancelFollowUps failed:", e),
      );
    }

    return jsonOk(lead);
  } catch (err) {
    return handleApiError(err);
  }
}
