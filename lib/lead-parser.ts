import { LeadSource } from "@prisma/client";
import { normalizePhone } from "@/lib/utils";

/**
 * Normalized lead extracted from a portal email or webhook, before it is
 * associated with a broker/property and persisted.
 */
export interface ParsedLead {
  name: string;
  phone: string; // normalized E.164 (+91XXXXXXXXXX)
  budget: string | null;
  source: LeadSource;
  propertyTitle: string | null;
  propertyRef: string | null;
}

interface RawEmail {
  subject: string;
  textBody: string;
  htmlBody?: string;
  fromEmail: string;
}

/**
 * Detect which portal an inbound email came from using sender + subject.
 */
export function detectSource(email: RawEmail): LeadSource {
  const from = email.fromEmail.toLowerCase();
  const subject = email.subject.toLowerCase();
  const haystack = `${from} ${subject}`;

  if (haystack.includes("99acres")) return LeadSource.NINETYNINEACRES;
  if (haystack.includes("magicbricks")) return LeadSource.MAGICBRICKS;
  if (haystack.includes("housing")) return LeadSource.HOUSING;
  return LeadSource.MANUAL;
}

/**
 * Pull the first value following any of the given labels in a block of text.
 * Handles "Label: value" and "Label - value" across lines.
 */
function extractField(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]\\s*(.+?)(?:\\r?\\n|$)`,
      "i",
    );
    const match = text.match(re);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value) return value;
    }
  }
  return null;
}

function extractPhone(text: string): string | null {
  // Try labelled phone first.
  const labelled = extractField(text, [
    "Phone",
    "Mobile",
    "Contact",
    "Contact No",
    "Mobile No",
  ]);
  const fromLabel = normalizePhone(labelled);
  if (fromLabel) return fromLabel;

  // Fall back to scanning for any Indian mobile pattern in the body.
  const candidates = text.match(/(?:\+?91[-\s]?|0)?[6-9]\d{9}/g);
  if (candidates) {
    for (const c of candidates) {
      const normalized = normalizePhone(c);
      if (normalized) return normalized;
    }
  }
  return null;
}

/**
 * Parse a raw portal email into a ParsedLead. Returns null when no usable
 * phone number can be found (a lead without a phone is not actionable).
 */
export function parseLeadEmail(email: RawEmail): ParsedLead | null {
  const body = email.textBody || stripHtml(email.htmlBody ?? "");
  const source = detectSource(email);

  const phone = extractPhone(body);
  if (!phone) return null;

  const name =
    extractField(body, ["Name", "Customer Name", "Lead Name", "Buyer Name"]) ??
    "Prospect";

  const budget = extractField(body, ["Budget", "Price Range", "Budget Range"]);

  const propertyTitle =
    extractField(body, [
      "Property",
      "Property Name",
      "Project",
      "Project Name",
      "Listing",
      "Regarding",
    ]) ?? subjectAsProperty(email.subject);

  const propertyRef = extractField(body, [
    "Property ID",
    "Listing ID",
    "Project ID",
    "Ref",
    "Reference",
  ]);

  return {
    name,
    phone,
    budget: budget ?? null,
    source,
    propertyTitle: propertyTitle ?? null,
    propertyRef: propertyRef ?? null,
  };
}

/**
 * Parse a generic JSON webhook payload (used by /api/webhooks/99acres and
 * /api/webhooks/magicbricks for direct integrations or manual testing).
 */
export function parseLeadWebhook(
  payload: Record<string, unknown>,
  source: LeadSource,
): ParsedLead | null {
  const get = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return null;
  };

  const phone = normalizePhone(get("phone", "mobile", "contact", "phoneNumber"));
  if (!phone) return null;

  return {
    name: get("name", "customerName", "leadName") ?? "Prospect",
    phone,
    budget: get("budget", "priceRange"),
    source,
    propertyTitle: get("property", "propertyTitle", "project", "listing"),
    propertyRef: get("propertyId", "listingId", "ref", "reference"),
  };
}

function subjectAsProperty(subject: string): string | null {
  // e.g. "New lead for 2BHK in Powai" -> "2BHK in Powai"
  const cleaned = subject.replace(/^.*?(?:for|:)\s*/i, "").trim();
  return cleaned || null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ");
}
