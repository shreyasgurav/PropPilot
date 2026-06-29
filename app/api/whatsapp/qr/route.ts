import { requireBroker } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getSessionQR } from "@/lib/openwa";

/**
 * GET /api/whatsapp/qr
 *
 * Proxy the QR code from OpenWA for the logged-in broker's session.
 * Returns { qrCode: "data:image/png;base64,..." } when the session
 * is in qr_ready state.
 */
export async function GET() {
  try {
    const broker = await requireBroker();

    if (!broker.openwaSessionId) {
      return jsonError("No WhatsApp session found. Connect first.", 404);
    }

    const result = await getSessionQR(broker.openwaSessionId);

    if (!result.ok) {
      return jsonError(
        result.error ?? "QR code not ready yet. Session may still be initializing.",
        result.error?.includes("no longer qr_ready") ? 410 : 502,
      );
    }

    return jsonOk({
      qrCode: result.qrCode,
      status: result.status,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
