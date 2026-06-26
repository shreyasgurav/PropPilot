import { type NextRequest } from "next/server";
import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { cancelFollowUps } from "@/lib/jobs";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const broker = await requireBroker();

    const lead = await prisma.lead.findFirst({
      where: { id: params.id, brokerId: broker.id },
      select: { id: true },
    });
    if (!lead) return jsonError("Lead not found", 404);

    await cancelFollowUps(lead.id);
    return jsonOk({ cancelled: true });
  } catch (err) {
    return handleApiError(err);
  }
}
