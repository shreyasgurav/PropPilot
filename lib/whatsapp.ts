import { normalizePhone } from "@/lib/utils";

/**
 * Meta WhatsApp Business API (Cloud API) client.
 *
 * We own the infrastructure directly on Meta's Graph API — no third-party
 * middleman. A single permanent System User token (WHATSAPP_ACCESS_TOKEN)
 * authenticates all calls. Each broker connects their own phone number under
 * our shared WhatsApp Business Account; the per-broker `phoneNumberId` selects
 * which number a message is sent from.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH_BASE = "https://graph.facebook.com";

function apiVersion(): string {
  return process.env.META_API_VERSION ?? "v19.0";
}

function accessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN must be set");
  }
  return token;
}

function graphUrl(path: string): string {
  return `${GRAPH_BASE}/${apiVersion()}/${path}`;
}

export interface SendMessagePayload {
  phoneNumberId: string; // broker's Meta phone number ID (the sender)
  to: string; // recipient phone, any common Indian format
  message: string; // text content
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string; // Meta's wamid
  error?: string;
  /** Meta error code when available, useful for callers to branch on. */
  code?: number;
}

export interface WebhookMessage {
  from: string; // sender's phone number (digits, no +)
  messageId: string; // wamid
  timestamp: string;
  text?: string;
  type: string; // text | image | audio | etc.
  phoneNumberId: string; // which business number received it
  contactName?: string;
}

interface MetaErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

interface MetaSendSuccessBody {
  messages?: Array<{ id: string }>;
  contacts?: Array<{ wa_id: string }>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalize any common Indian phone format to E.164 (+91XXXXXXXXXX).
 * Falls back to the raw input when it cannot be confidently normalized, so
 * Meta returns a clear error rather than us silently dropping the message.
 */
export function normalizeIndianPhone(phone: string): string {
  return normalizePhone(phone) ?? phone.trim();
}

/**
 * Send a free-text WhatsApp message via the Cloud API.
 * Never throws — always resolves with a result object. Retries once on 5xx.
 */
export async function sendWhatsAppMessage(
  payload: SendMessagePayload,
): Promise<SendMessageResult> {
  const { phoneNumberId, to, message } = payload;

  if (!phoneNumberId) {
    return { success: false, error: "Broker has no WhatsApp number connected" };
  }

  const normalizedTo = normalizeIndianPhone(to);
  const url = graphUrl(`${phoneNumberId}/messages`);
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedTo,
    type: "text",
    text: { preview_url: false, body: message },
  });

  let token: string;
  try {
    token = accessToken();
  } catch (err) {
    const error = err instanceof Error ? err.message : "Missing access token";
    return { success: false, error };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      });

      const json = (await res.json().catch(() => ({}))) as
        | (MetaSendSuccessBody & MetaErrorBody)
        | Record<string, never>;

      // Meta can return 200 with an `error` field, or a non-2xx with one.
      if (json.error) {
        const code = json.error.code;
        const errMsg = json.error.message ?? "WhatsApp send failed";
        logMetaError("sendWhatsAppMessage", code, errMsg);

        // Retry once on transient rate-limit/server errors.
        if ((res.status >= 500 || code === 130429) && attempt === 0) {
          await sleep(code === 130429 ? 2000 : 2000);
          continue;
        }
        return { success: false, error: errMsg, code };
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt === 0) {
          await sleep(2000);
          continue;
        }
        return { success: false, error: `Meta API HTTP ${res.status}` };
      }

      const messageId = json.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err) {
      if (attempt === 0) {
        await sleep(2000);
        continue;
      }
      const error = err instanceof Error ? err.message : "Unknown send error";
      return { success: false, error };
    }
  }

  return { success: false, error: "WhatsApp send failed after retry" };
}

/**
 * Safely parse Meta's webhook payload into a single inbound message.
 * Returns null for non-message events (delivery/read status updates, etc.).
 */
export function parseWebhookMessage(body: unknown): WebhookMessage | null {
  try {
    const root = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string };
            contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
            messages?: Array<{
              from?: string;
              id?: string;
              timestamp?: string;
              type?: string;
              text?: { body?: string };
            }>;
          };
        }>;
      }>;
    };

    const value = root.entry?.[0]?.changes?.[0]?.value;
    if (!value) return null;

    const msg = value.messages?.[0];
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!msg || !phoneNumberId || !msg.from || !msg.id) return null;

    const type = msg.type ?? "unknown";
    const text = type === "text" ? msg.text?.body : `[${type} message]`;

    return {
      from: msg.from,
      messageId: msg.id,
      timestamp: msg.timestamp ?? "",
      text,
      type,
      phoneNumberId,
      contactName: value.contacts?.[0]?.profile?.name,
    };
  } catch (err) {
    console.error("parseWebhookMessage failed:", err);
    return null;
  }
}

/**
 * Verify a webhook subscription handshake (GET).
 * Returns the challenge string when valid, otherwise null.
 */
export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): string | null {
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token && token === expected) {
    return challenge ?? "";
  }
  return null;
}

/**
 * Mark an inbound message as read (best-effort; never throws).
 */
export async function markMessageRead(
  phoneNumberId: string,
  messageId: string,
): Promise<void> {
  try {
    const res = await fetch(graphUrl(`${phoneNumberId}/messages`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as MetaErrorBody;
      logMetaError("markMessageRead", json.error?.code, json.error?.message);
    }
  } catch (err) {
    console.error("markMessageRead failed:", err);
  }
}

export interface PhoneNumberDetails {
  displayName: string;
  phoneNumber: string;
}

/**
 * Fetch display name + phone number for a given Phone Number ID.
 * Returns null when the id is invalid or the call fails.
 */
export async function getPhoneNumberDetails(
  phoneNumberId: string,
): Promise<PhoneNumberDetails | null> {
  try {
    const res = await fetch(
      graphUrl(`${phoneNumberId}?fields=display_phone_number,verified_name`),
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken()}` },
      },
    );

    const json = (await res.json().catch(() => ({}))) as {
      display_phone_number?: string;
      verified_name?: string;
    } & MetaErrorBody;

    if (!res.ok || json.error || !json.display_phone_number) {
      logMetaError(
        "getPhoneNumberDetails",
        json.error?.code,
        json.error?.message ?? `HTTP ${res.status}`,
      );
      return null;
    }

    return {
      displayName: json.verified_name ?? "",
      phoneNumber: json.display_phone_number,
    };
  } catch (err) {
    console.error("getPhoneNumberDetails failed:", err);
    return null;
  }
}

/**
 * Confirm a Phone Number ID resolves on Meta under our token.
 */
export async function validatePhoneNumberId(
  phoneNumberId: string,
): Promise<boolean> {
  const details = await getPhoneNumberDetails(phoneNumberId);
  return details !== null;
}

function logMetaError(
  context: string,
  code: number | undefined,
  message: string | undefined,
): void {
  if (code === 190) {
    console.error(`[${context}] Meta token expired or invalid (code 190)`);
  } else if (code === 131026) {
    console.error(`[${context}] Invalid/unreachable recipient (code 131026)`);
  } else if (code === 130429) {
    console.error(`[${context}] Rate limited by Meta (code 130429)`);
  } else if (code === 132000) {
    console.error(`[${context}] Template not approved (code 132000)`);
  } else {
    console.error(`[${context}] Meta error ${code ?? "?"}: ${message ?? ""}`);
  }
}
