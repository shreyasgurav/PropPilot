import { type NextRequest } from "next/server";
import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonOk } from "@/lib/api";
import { createPropertySchema } from "@/lib/validation";

export async function GET() {
  try {
    const broker = await requireBroker();
    const properties = await prisma.property.findMany({
      where: { brokerId: broker.id },
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(properties);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const broker = await requireBroker();
    const body = await request.json();
    const input = createPropertySchema.parse(body);

    const property = await prisma.property.create({
      data: {
        brokerId: broker.id,
        title: input.title,
        location: input.location,
        price: input.price,
        bedrooms: input.bedrooms ?? null,
        description: input.description ?? null,
        externalRef: input.externalRef ?? null,
      },
    });

    return jsonOk(property, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
