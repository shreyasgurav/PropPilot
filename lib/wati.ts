import { toWatiPhone } from "@/lib/utils";

/**
 * Minimal WATI (wati.io) REST client.
 *
 * WATI exposes a tenant-scoped base endpoint (WATI_API_ENDPOINT) and a bearer
 * token (WATI_API_TOKEN). We use the "sendSessionMessage" endpoint for free-text
 * replies inside the 24h window. For first-contact outside a session you would
 * normally use an approved template via "sendTemplateMessage"; that is wired the
 * same way and can be swapped in once templates are approved.
 */

export interface SendMessageResult {
  ok: boolean;
  status: number;
  error?: string;
}

function getConfig(): { endpoint: string; token: string } {
  const endpoint = process.env.WATI_API_ENDPOINT;
  const token = process.env.WATI_API_TOKEN;
  if (!endpoint || !token) {
    throw new Error("WATI_API_ENDPOINT and WATI_API_TOKEN must be set");
  }
  return { endpoint: endpoint.replace(/\/$/, ""), token };
}

function authHeader(token: string): string {
  // Allow the env var to optionally already include the "Bearer " prefix.
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

/**
 * Send a free-text WhatsApp session message to an E.164 phone (+91XXXXXXXXXX).
 */
export async function sendMessage(
  e164Phone: string,
  message: string,
): Promise<SendMessageResult> {
  try {
    const { endpoint, token } = getConfig();
    const whatsappNumber = toWatiPhone(e164Phone);

    const url =
      `${endpoint}/api/v1/sendSessionMessage/${encodeURIComponent(whatsappNumber)}` +
      `?messageText=${encodeURIComponent(message)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(token),
        "Content-Type": "application/json-patch+json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text || res.statusText };
    }

    return { ok: true, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown WATI error";
    return { ok: false, status: 0, error: message };
  }
}

/**
 * Shape of the inbound webhook payload WATI sends when a contact replies.
 * Only the fields we rely on are typed; extra fields are ignored.
 */
export interface WatiInboundPayload {
  eventType?: string;
  waId?: string; // sender phone in 91XXXXXXXXXX form
  senderName?: string;
  text?: string;
  type?: string; // "text", "image", etc.
  owner?: boolean; // true when the message was sent by the business, not the contact
}

/**
 * Extract a normalized { phone, text } from a WATI inbound webhook body,
 * or null when the event is not an inbound text from the contact.
 */
export function parseWatiInbound(
  body: WatiInboundPayload,
): { waId: string; text: string; senderName: string } | null {
  if (body.owner === true) return null; // ignore echoes of our own messages
  if (!body.waId || !body.text) return null;
  if (body.type && body.type !== "text") {
    // Still record non-text replies as a generic note.
    return { waId: body.waId, text: `[${body.type} message]`, senderName: body.senderName ?? "" };
  }
  return { waId: body.waId, text: body.text, senderName: body.senderName ?? "" };
}
