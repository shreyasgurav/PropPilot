import { type NextRequest } from "next/server";
import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { createLeadSchema } from "@/lib/validation";
import { createLeadAndKickoff } from "@/lib/lead-service";
import { normalizePhone } from "@/lib/utils";
import { LeadStatus, LeadSource, type Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const broker = await requireBroker();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const search = searchParams.get("q");

    const where: Prisma.LeadWhereInput = { brokerId: broker.id };

    if (status && status in LeadStatus) {
      where.status = status as LeadStatus;
    }
    if (source && source in LeadSource) {
      where.source = source as LeadSource;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: { property: { select: { id: true, title: true, location: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return jsonOk(leads);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const broker = await requireBroker();
    const body = await request.json();
    const input = createLeadSchema.parse(body);

    const phone = normalizePhone(input.phone);
    if (!phone) {
      return jsonError("Invalid Indian phone number", 422);
    }

    const result = await createLeadAndKickoff(broker.id, {
      name: input.name,
      phone,
      budget: input.budget ?? null,
      source: input.source,
      propertyId: input.propertyId ?? null,
      notes: input.notes ?? null,
    });

    return jsonOk(result, result.duplicate ? 200 : 201);
  } catch (err) {
    return handleApiError(err);
  }
}
