/**
 * OpenWA REST API Client.
 *
 * Wraps the self-hosted OpenWA gateway (https://github.com/rmyndharis/OpenWA)
 * in a typed client. PropPilot uses this to create sessions, show QR codes,
 * send messages, and register webhooks — all via HTTP.
 *
 * Requires two env vars:
 *   OPENWA_BASE_URL  — e.g. http://localhost:2785 or https://openwa.yourdomain.com
 *   OPENWA_API_KEY   — the admin key from OpenWA's data/.api-key
 */

function baseUrl(): string {
  const url = process.env.OPENWA_BASE_URL;
  if (!url) throw new Error("OPENWA_BASE_URL must be set");
  return url.replace(/\/+$/, ""); // strip trailing slashes
}

function apiKey(): string {
  const key = process.env.OPENWA_API_KEY;
  if (!key) throw new Error("OPENWA_API_KEY must be set");
  return key;
}

async function openwaFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  const url = `${baseUrl()}/api${path}`;
  const headers: Record<string, string> = {
    "X-API-Key": apiKey(),
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };

    if (!res.ok) {
      const errMsg =
        (json as { message?: string }).message ??
        (json as { error?: string }).error ??
        `OpenWA HTTP ${res.status}`;
      return { ok: false, status: res.status, data: json, error: errMsg };
    }

    return { ok: true, status: res.status, data: json };
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenWA request failed";
    return { ok: false, status: 0, data: {} as T, error: message };
  }
}

// ─── Session Management ──────────────────────────────────────────

export interface OpenWASession {
  id: string;
  name: string;
  status: string; // created | initializing | qr_ready | authenticating | ready | disconnected
  phone?: string;
  pushName?: string;
  connectedAt?: string;
}

export async function createSession(name: string): Promise<{
  ok: boolean;
  session?: OpenWASession;
  error?: string;
}> {
  const res = await openwaFetch<OpenWASession>("/sessions", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return { ok: res.ok, session: res.ok ? res.data : undefined, error: res.error };
}

export async function startSession(sessionId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const res = await openwaFetch(`/sessions/${sessionId}/start`, {
    method: "POST",
  });
  return { ok: res.ok, error: res.error };
}

export async function getSessionQR(sessionId: string): Promise<{
  ok: boolean;
  qrCode?: string;
  status?: string;
  error?: string;
}> {
  const res = await openwaFetch<{ qrCode?: string; status?: string }>(
    `/sessions/${sessionId}/qr`,
  );
  return {
    ok: res.ok,
    qrCode: res.data?.qrCode,
    status: res.data?.status,
    error: res.error,
  };
}

export async function getSessionStatus(sessionId: string): Promise<{
  ok: boolean;
  session?: OpenWASession;
  error?: string;
}> {
  const res = await openwaFetch<OpenWASession>(`/sessions/${sessionId}`);
  return { ok: res.ok, session: res.ok ? res.data : undefined, error: res.error };
}

export async function deleteSession(sessionId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const res = await openwaFetch(`/sessions/${sessionId}`, {
    method: "DELETE",
  });
  return { ok: res.ok, error: res.error };
}

// ─── Messaging ───────────────────────────────────────────────────

export interface SendTextResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a text message through a broker's OpenWA session.
 *
 * @param sessionId  The broker's OpenWA session ID (sess_...)
 * @param phone      Recipient phone in E.164 format (+91XXXXXXXXXX)
 * @param text       The message content
 */
export async function sendText(
  sessionId: string,
  phone: string,
  text: string,
): Promise<SendTextResult> {
  // OpenWA requires the format: 91XXXXXXXXXX@c.us (no +, with @c.us)
  const chatId = formatChatId(phone);

  const res = await openwaFetch<{ messageId?: string }>(
    `/sessions/${sessionId}/messages/send-text`,
    {
      method: "POST",
      body: JSON.stringify({ chatId, text }),
    },
  );

  return {
    ok: res.ok,
    messageId: res.data?.messageId,
    error: res.error,
  };
}

// ─── Webhooks ────────────────────────────────────────────────────

export async function registerWebhook(
  sessionId: string,
  url: string,
  events: string[],
  secret?: string,
): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, unknown> = { url, events };
  if (secret) body.secret = secret;

  const res = await openwaFetch(`/sessions/${sessionId}/webhooks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { ok: res.ok, error: res.error };
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Convert any phone format to OpenWA's chatId format: digits@c.us
 * E.g. "+917058644548" → "917058644548@c.us"
 */
export function formatChatId(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, "");
  return `${digits}@c.us`;
}

/**
 * Extract a phone number from an OpenWA chatId.
 * E.g. "917058644548@c.us" → "+917058644548"
 */
export function phonefromChatId(chatId: string): string {
  const digits = chatId.replace(/@.*$/, "").replace(/\D/g, "");
  return `+${digits}`;
}
