import { type NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { processDueFollowUps } from "@/lib/jobs";

// pg-boss needs the Node.js runtime (not edge) and must not be statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron endpoint that drains due follow-up jobs.
 * Configure Vercel Cron to call this every minute (see vercel.json).
 * Authenticated via the Authorization: Bearer <CRON_SECRET> header that
 * Vercel Cron sends automatically.
 */
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const result = await processDueFollowUps();
    return jsonOk(result);
  } catch (err) {
    console.error("jobs/process error:", err);
    return jsonError("Job processing failed", 500);
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
