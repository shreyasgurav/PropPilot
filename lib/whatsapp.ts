import { normalizePhone } from "@/lib/utils";
import { sendText, formatChatId, phonefromChatId } from "@/lib/openwa";

/**
 * OpenWA-based WhatsApp messaging client.
 *
 * Replaces the previous Meta Cloud API implementation. Messages are now sent
 * through the self-hosted OpenWA gateway via each broker's linked session.
 * Brokers keep using the normal WhatsApp app on their phone.
 */

export interface SendMessagePayload {
  sessionId: string; // broker's OpenWA session ID (sess_...)
  to: string;        // recipient phone, any common Indian format
  message: string;   // text content
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WebhookMessage {
  from: string;          // sender's phone number (E.164)
  messageId: string;
  timestamp: string;
  text?: string;
  type: string;          // chat | image | audio | etc.
  sessionId: string;     // which broker session received it
  contactName?: string;
}

/**
 * Normalize any common Indian phone format to E.164 (+91XXXXXXXXXX).
 * Falls back to the raw input when it cannot be confidently normalized.
 */
export function normalizeIndianPhone(phone: string): string {
  const normalized = normalizePhone(phone) ?? phone.trim();
  return normalized.startsWith("+") ? normalized.slice(1) : normalized;
}

/**
 * Send a free-text WhatsApp message via the OpenWA gateway.
 * Never throws — always resolves with a result object.
 */
export async function sendWhatsAppMessage(
  payload: SendMessagePayload,
): Promise<SendMessageResult> {
  const { sessionId, to, message } = payload;

  if (!sessionId) {
    return { success: false, error: "Broker has no WhatsApp session connected" };
  }

  const result = await sendText(sessionId, to, message);

  return {
    success: result.ok,
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Parse an OpenWA webhook payload into a single inbound message.
 * Returns null for non-message events.
 *
 * OpenWA sends events like:
 * {
 *   "event": "message.received",
 *   "sessionId": "sess_...",
 *   "data": {
 *     "from": "919876543210@c.us",
 *     "body": "I'm interested!",
 *     "type": "chat",
 *     "id": { "_serialized": "true_919876543210@c.us_3EB0..." },
 *     "timestamp": 1719400000,
 *     "fromMe": false,
 *     "notifyName": "Vikram"
 *   }
 * }
 */
export function parseWebhookMessage(body: unknown): WebhookMessage | null {
  try {
    const root = body as {
      event?: string;
      sessionId?: string;
      data?: {
        from?: string;
        body?: string;
        type?: string;
        id?: { _serialized?: string } | string;
        timestamp?: number;
        fromMe?: boolean;
        notifyName?: string;
      };
    };

    // Only process inbound messages
    if (root.event !== "message.received") return null;
    if (!root.sessionId || !root.data) return null;

    const msg = root.data;
    if (!msg.from || msg.fromMe) return null;

    const messageId =
      typeof msg.id === "object" ? msg.id?._serialized ?? "" : String(msg.id ?? "");

    const text = msg.type === "chat" ? msg.body : `[${msg.type ?? "unknown"} message]`;

    return {
      from: phonefromChatId(msg.from),
      messageId,
      timestamp: String(msg.timestamp ?? ""),
      text,
      type: msg.type ?? "unknown",
      sessionId: root.sessionId,
      contactName: msg.notifyName,
    };
  } catch (err) {
    console.error("parseWebhookMessage failed:", err);
    return null;
  }
}

// Re-export for convenience
export { formatChatId, phonefromChatId };
