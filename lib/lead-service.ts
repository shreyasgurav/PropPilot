import { prisma } from "@/lib/prisma";
import {
  buildTemplateContext,
  sendToProspect,
  type LeadWithRelations,
} from "@/lib/messaging";
import { initialMessage } from "@/lib/whatsapp-templates";
import { scheduleFollowUps } from "@/lib/jobs";
import { LeadSource, LeadStatus } from "@prisma/client";
import type { ParsedLead } from "@/lib/lead-parser";

export interface CreateLeadInput {
  name: string;
  phone: string; // expected already normalized to +91XXXXXXXXXX
  budget?: string | null;
  source: LeadSource;
  propertyId?: string | null;
  propertyTitle?: string | null;
  propertyRef?: string | null;
  notes?: string | null;
}

export interface CreateLeadResult {
  leadId: string;
  duplicate: boolean;
  initialMessageSent: boolean;
}

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve a propertyId for a broker from an explicit id, an external reference,
 * or a fuzzy title match. Returns null when nothing matches.
 */
async function resolvePropertyId(
  brokerId: string,
  input: { propertyId?: string | null; propertyRef?: string | null; propertyTitle?: string | null },
): Promise<string | null> {
  if (input.propertyId) {
    const owned = await prisma.property.findFirst({
      where: { id: input.propertyId, brokerId },
      select: { id: true },
    });
    if (owned) return owned.id;
  }

  if (input.propertyRef) {
    const byRef = await prisma.property.findFirst({
      where: { brokerId, externalRef: input.propertyRef },
      select: { id: true },
    });
    if (byRef) return byRef.id;
  }

  if (input.propertyTitle) {
    const byTitle = await prisma.property.findFirst({
      where: { brokerId, title: { contains: input.propertyTitle, mode: "insensitive" } },
      select: { id: true },
    });
    if (byTitle) return byTitle.id;
  }

  return null;
}

/**
 * Core entrypoint: create (or de-duplicate) a lead, send the instant initial
 * WhatsApp message, and schedule Day 1/3/7 follow-ups.
 *
 * Idempotency: if the same phone enquired about the same property for the same
 * broker within the last 24h, the existing lead is updated and NO new initial
 * message is sent.
 */
export async function createLeadAndKickoff(
  brokerId: string,
  input: CreateLeadInput,
): Promise<CreateLeadResult> {
  const propertyId = await resolvePropertyId(brokerId, input);

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const existing = await prisma.lead.findFirst({
    where: {
      brokerId,
      phone: input.phone,
      propertyId: propertyId ?? undefined,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        // Enrich with any newly provided details without clobbering with nulls.
        budget: input.budget ?? existing.budget,
        notes: input.notes ?? existing.notes,
      },
    });
    return { leadId: existing.id, duplicate: true, initialMessageSent: false };
  }

  const lead = await prisma.lead.create({
    data: {
      brokerId,
      propertyId,
      name: input.name,
      phone: input.phone,
      budget: input.budget ?? null,
      source: input.source,
      status: LeadStatus.NEW,
      notes: input.notes ?? null,
    },
    include: { broker: true, property: true },
  });

  const ctx = buildTemplateContext(lead as LeadWithRelations);
  const send = await sendToProspect(lead as LeadWithRelations, initialMessage(ctx));

  if (send.ok) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: LeadStatus.CONTACTED },
    });
  }

  // Schedule follow-ups regardless; the processor re-checks status/rate limits.
  try {
    await scheduleFollowUps(lead.id);
  } catch (err) {
    console.error("scheduleFollowUps failed for lead", lead.id, err);
  }

  return { leadId: lead.id, duplicate: false, initialMessageSent: send.ok };
}

/**
 * Convenience wrapper used by portal webhooks that already produced a ParsedLead.
 */
export async function ingestParsedLead(
  brokerId: string,
  parsed: ParsedLead,
): Promise<CreateLeadResult> {
  return createLeadAndKickoff(brokerId, {
    name: parsed.name,
    phone: parsed.phone,
    budget: parsed.budget,
    source: parsed.source,
    propertyTitle: parsed.propertyTitle,
    propertyRef: parsed.propertyRef,
  });
}
