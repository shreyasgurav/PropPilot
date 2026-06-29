import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { deleteSession } from "@/lib/openwa";

/**
 * POST /api/whatsapp/disconnect
 *
 * Disconnect the broker's WhatsApp by deleting their OpenWA session
 * and clearing the connection fields in the database.
 */
export async function POST() {
  try {
    const broker = await requireBroker();

    if (!broker.openwaSessionId) {
      return jsonError("No WhatsApp session to disconnect", 404);
    }

    // Best-effort: delete the session on OpenWA.
    // If OpenWA is unreachable, we still clear the DB so the broker can reconnect.
    await deleteSession(broker.openwaSessionId).catch((err) =>
      console.error("OpenWA deleteSession failed (non-fatal):", err),
    );

    await prisma.broker.update({
      where: { id: broker.id },
      data: {
        openwaSessionId: null,
        openwaSessionName: null,
        waPhoneNumber: null,
        waPushName: null,
        isWhatsappConnected: false,
        whatsappConnectedAt: null,
      },
    });

    return jsonOk({ disconnected: true });
  } catch (err) {
    return handleApiError(err);
  }
}
