import { type NextRequest } from "next/server";
import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { updatePropertySchema } from "@/lib/validation";

interface RouteContext {
  params: { id: string };
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const broker = await requireBroker();

    const existing = await prisma.property.findFirst({
      where: { id: params.id, brokerId: broker.id },
      select: { id: true },
    });
    if (!existing) return jsonError("Property not found", 404);

    const body = await request.json();
    const input = updatePropertySchema.parse(body);

    const property = await prisma.property.update({
      where: { id: params.id },
      data: {
        title: input.title,
        location: input.location,
        price: input.price,
        bedrooms: input.bedrooms,
        description: input.description,
        externalRef: input.externalRef,
      },
    });

    return jsonOk(property);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const broker = await requireBroker();

    const existing = await prisma.property.findFirst({
      where: { id: params.id, brokerId: broker.id },
      select: { id: true },
    });
    if (!existing) return jsonError("Property not found", 404);

    await prisma.property.delete({ where: { id: params.id } });
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
