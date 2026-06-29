import { type NextRequest } from "next/server";
import { requireBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  createSession,
  startSession,
  registerWebhook,
} from "@/lib/openwa";

/**
 * Connect (or reconnect) the broker's WhatsApp via OpenWA.
 *
 * Creates an OpenWA session, starts it (which boots the WA engine),
 * and registers a webhook so inbound messages are forwarded to PropPilot.
 * The client then polls /api/whatsapp/qr to show the QR code.
 */
export async function POST() {
  try {
    const broker = await requireBroker();

    // If broker already has a session, return its ID so the client can
    // fetch the QR or status directly.
    if (broker.openwaSessionId) {
      // Try to restart the existing session in case it was stopped.
      await startSession(broker.openwaSessionId);
      return jsonOk({ sessionId: broker.openwaSessionId, existing: true });
    }

    // Create a unique session name from the broker's cuid.
    const sessionName = `broker-${broker.id.slice(-8)}`;

    const created = await createSession(sessionName);
    if (!created.ok || !created.session) {
      return jsonError(
        created.error ?? "Failed to create WhatsApp session on OpenWA",
        502,
      );
    }

    const sessionId = created.session.id;

    // Start the session (boots the WhatsApp engine and generates QR).
    const started = await startSession(sessionId);
    if (!started.ok) {
      return jsonError(
        started.error ?? "Failed to start WhatsApp session",
        502,
      );
    }

    // Register a webhook so OpenWA forwards inbound messages to PropPilot.
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/webhooks/openwa`;
    const webhookSecret = process.env.OPENWA_WEBHOOK_SECRET;

    await registerWebhook(
      sessionId,
      webhookUrl,
      ["message.received"],
      webhookSecret,
    ).catch((err) =>
      console.error("Webhook registration failed (non-fatal):", err),
    );

    // Persist the session on the broker row.
    await prisma.broker.update({
      where: { id: broker.id },
      data: {
        openwaSessionId: sessionId,
        openwaSessionName: sessionName,
      },
    });

    return jsonOk({ sessionId, existing: false }, 201);
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
        openwaSessionId: true,
        openwaSessionName: true,
        waPhoneNumber: true,
        waPushName: true,
        isWhatsappConnected: true,
        whatsappConnectedAt: true,
      },
    });
    return jsonOk(data);
  } catch (err) {
    return handleApiError(err);
  }
}
