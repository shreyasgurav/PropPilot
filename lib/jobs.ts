import PgBoss from "pg-boss";
import { prisma } from "@/lib/prisma";
import {
  buildTemplateContext,
  hasContactedToday,
  sendToProspect,
  type LeadWithRelations,
} from "@/lib/messaging";
import { followupForDay, type FollowUpDay } from "@/lib/whatsapp-templates";
import { FollowUpStatus, LeadStatus } from "@prisma/client";

export const FOLLOWUP_QUEUE = "followup-messages";
export const FOLLOWUP_DAYS: FollowUpDay[] = [1, 3, 7];

interface FollowUpJobData {
  leadId: string;
  followUpJobId: string;
  day: FollowUpDay;
}

let bossInstance: PgBoss | null = null;
let started = false;

/**
 * Lazily create and start a singleton pg-boss instance.
 * Uses DIRECT_URL (non-pooled) which pg-boss requires for its LISTEN/NOTIFY
 * and scheduling machinery.
 */
export async function getBoss(): Promise<PgBoss> {
  if (!bossInstance) {
    const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DIRECT_URL or DATABASE_URL must be set for pg-boss");
    }
    bossInstance = new PgBoss({ connectionString, schema: "pgboss" });
  }
  if (!started) {
    await bossInstance.start();
    await bossInstance.createQueue(FOLLOWUP_QUEUE);
    started = true;
  }
  return bossInstance;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Create FollowUpJob rows for Day 1/3/7 and enqueue them in pg-boss with the
 * appropriate delay. Called right after a lead's initial message is sent.
 */
export async function scheduleFollowUps(
  leadId: string,
  base: Date = new Date(),
): Promise<void> {
  const boss = await getBoss();

  for (const day of FOLLOWUP_DAYS) {
    const scheduledAt = addDays(base, day);

    const followUpJob = await prisma.followUpJob.create({
      data: { leadId, day, scheduledAt, status: FollowUpStatus.PENDING },
    });

    const data: FollowUpJobData = { leadId, followUpJobId: followUpJob.id, day };
    const pgBossJobId = await boss.send(FOLLOWUP_QUEUE, data, {
      startAfter: scheduledAt,
      retryLimit: 2,
      retryDelay: 300,
    });

    if (pgBossJobId) {
      await prisma.followUpJob.update({
        where: { id: followUpJob.id },
        data: { pgBossJobId },
      });
    }
  }
}

/**
 * Cancel all pending follow-ups for a lead (e.g. prospect replied, or broker
 * marked the lead CLOSED/LOST). Marks DB rows SKIPPED and cancels pg-boss jobs.
 */
export async function cancelFollowUps(leadId: string): Promise<void> {
  const pending = await prisma.followUpJob.findMany({
    where: { leadId, status: FollowUpStatus.PENDING },
  });
  if (pending.length === 0) return;

  try {
    const boss = await getBoss();
    const ids = pending
      .map((j) => j.pgBossJobId)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      await boss.cancel(FOLLOWUP_QUEUE, ids);
    }
  } catch (err) {
    console.error("cancelFollowUps: pg-boss cancel failed:", err);
  }

  await prisma.followUpJob.updateMany({
    where: { leadId, status: FollowUpStatus.PENDING },
    data: { status: FollowUpStatus.SKIPPED },
  });
}

/**
 * Pull and process all due follow-up jobs. Invoked by the cron endpoint
 * (/api/jobs/process) every minute. Returns counts for observability.
 */
export async function processDueFollowUps(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const boss = await getBoss();
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Drain in batches until no due jobs remain.
  for (;;) {
    const jobs = await boss.fetch<FollowUpJobData>(FOLLOWUP_QUEUE, {
      batchSize: 25,
    });
    if (!jobs || jobs.length === 0) break;

    for (const job of jobs) {
      processed += 1;
      const outcome = await handleFollowUpJob(job.data);
      if (outcome === "sent") sent += 1;
      else if (outcome === "skipped") skipped += 1;
      else failed += 1;

      try {
        if (outcome === "failed") {
          await boss.fail(FOLLOWUP_QUEUE, job.id);
        } else {
          await boss.complete(FOLLOWUP_QUEUE, job.id);
        }
      } catch (err) {
        console.error("pg-boss ack failed for job", job.id, err);
      }
    }
  }

  return { processed, sent, skipped, failed };
}

type Outcome = "sent" | "skipped" | "failed";

const TERMINAL_STATUSES: LeadStatus[] = [
  LeadStatus.CLOSED,
  LeadStatus.LOST,
  LeadStatus.INTERESTED,
  LeadStatus.VISIT_SCHEDULED,
  LeadStatus.NEGOTIATING,
];

async function handleFollowUpJob(data: FollowUpJobData): Promise<Outcome> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: data.leadId },
      include: { broker: true, property: true },
    });

    const followUpRow = await prisma.followUpJob.findUnique({
      where: { id: data.followUpJobId },
    });

    // Already handled or cancelled.
    if (!lead || !followUpRow || followUpRow.status !== FollowUpStatus.PENDING) {
      await markFollowUp(data.followUpJobId, FollowUpStatus.SKIPPED);
      return "skipped";
    }

    // Prospect already engaged or deal resolved — stop nurturing.
    if (TERMINAL_STATUSES.includes(lead.status)) {
      await markFollowUp(data.followUpJobId, FollowUpStatus.SKIPPED);
      return "skipped";
    }

    // Rate limit: at most one outbound message per lead per day.
    if (await hasContactedToday(lead.id)) {
      await markFollowUp(data.followUpJobId, FollowUpStatus.SKIPPED);
      return "skipped";
    }

    const ctx = buildTemplateContext(lead as LeadWithRelations);
    const message = followupForDay(data.day, ctx);
    const result = await sendToProspect(lead as LeadWithRelations, message);

    if (!result.ok) {
      await markFollowUp(data.followUpJobId, FollowUpStatus.FAILED);
      return "failed";
    }

    await prisma.$transaction([
      prisma.followUpJob.update({
        where: { id: data.followUpJobId },
        data: { status: FollowUpStatus.SENT, sentAt: new Date() },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.CONTACTED },
      }),
    ]);

    return "sent";
  } catch (err) {
    console.error("handleFollowUpJob error:", err);
    await markFollowUp(data.followUpJobId, FollowUpStatus.FAILED).catch(() => {});
    return "failed";
  }
}

async function markFollowUp(id: string, status: FollowUpStatus): Promise<void> {
  await prisma.followUpJob.update({ where: { id }, data: { status } });
}
