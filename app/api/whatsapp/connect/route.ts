import { type NextRequest } from "next/server";
import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { connectWhatsappSchema } from "@/lib/validation";
import { getPhoneNumberDetails } from "@/lib/whatsapp";

/**
 * Connect (or update) the broker's WhatsApp Business number.
 *
 * The broker pastes their Phone Number ID + WABA ID from the Meta dashboard.
 * We verify the Phone Number ID resolves under our access token, then persist
 * the connection on the Broker row.
 */
export async function POST(request: NextRequest) {
  try {
    const broker = await requireBroker();

    const body = await request.json();
    const { phoneNumberId, wabaId } = connectWhatsappSchema.parse(body);

    // Prevent the same Meta number being claimed by two brokers.
    const clash = await prisma.broker.findFirst({
      where: { metaPhoneNumberId: phoneNumberId, NOT: { id: broker.id } },
      select: { id: true },
    });
    if (clash) {
      return jsonError(
        "This WhatsApp number is already connected to another account",
        409,
      );
    }

    const details = await getPhoneNumberDetails(phoneNumberId);
    if (!details) {
      return jsonError(
        "Could not verify this Phone Number ID with Meta. Check the ID and that your access token has access to it.",
        422,
      );
    }

    const updated = await prisma.broker.update({
      where: { id: broker.id },
      data: {
        metaPhoneNumberId: phoneNumberId,
        metaWabaId: wabaId,
        metaPhoneNumber: details.phoneNumber,
        metaDisplayName: details.displayName,
        isWhatsappConnected: true,
        whatsappConnectedAt: new Date(),
      },
      select: {
        metaPhoneNumber: true,
        metaDisplayName: true,
        isWhatsappConnected: true,
        whatsappConnectedAt: true,
      },
    });

    return jsonOk(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Return the current broker's WhatsApp connection status.
 */
export async function GET() {
  try {
    const broker = await requireBroker();
    const data = await prisma.broker.findUnique({
      where: { id: broker.id },
      select: {
        metaPhoneNumberId: true,
        metaWabaId: true,
        metaPhoneNumber: true,
        metaDisplayName: true,
        isWhatsappConnected: true,
        whatsappConnectedAt: true,
      },
    });
    return jsonOk(data);
  } catch (err) {
    return handleApiError(err);
  }
}
