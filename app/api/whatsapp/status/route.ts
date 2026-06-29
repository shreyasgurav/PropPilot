import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getSessionStatus } from "@/lib/openwa";

/**
 * GET /api/whatsapp/status
 *
 * Poll the broker's OpenWA session status. The UI calls this every 3 seconds
 * while showing the QR code to detect when the broker scans it.
 *
 * When the session reaches "ready", we also update the broker's DB row
 * with the detected phone number and display name.
 */
export async function GET() {
  try {
    const broker = await requireBroker();

    if (!broker.openwaSessionId) {
      return jsonOk({
        status: "disconnected",
        isWhatsappConnected: false,
      });
    }

    const result = await getSessionStatus(broker.openwaSessionId);

    if (!result.ok || !result.session) {
      return jsonError(
        result.error ?? "Could not check session status",
        502,
      );
    }

    const session = result.session;

    // If the session just became ready and we haven't stored the phone yet,
    // update the broker's DB row with the detected phone + display name.
    if (session.status === "ready" && !broker.isWhatsappConnected) {
      await prisma.broker.update({
        where: { id: broker.id },
        data: {
          waPhoneNumber: session.phone ?? null,
          waPushName: session.pushName ?? null,
          isWhatsappConnected: true,
          whatsappConnectedAt: new Date(),
        },
      });
    }

    // If session disconnected, mark broker as disconnected too.
    if (session.status === "disconnected" && broker.isWhatsappConnected) {
      await prisma.broker.update({
        where: { id: broker.id },
        data: { isWhatsappConnected: false },
      });
    }

    return jsonOk({
      status: session.status,
      phone: session.phone,
      pushName: session.pushName,
      isWhatsappConnected: session.status === "ready",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
