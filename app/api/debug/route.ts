import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/debug
 * Checks every env var and service, returns JSON with pass/fail for each.
 * DELETE THIS ROUTE before launching to real users.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const results: Record<string, unknown> = {};

  // 1. Env vars
  results.env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    DIRECT_URL: !!process.env.DIRECT_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_PREFIX:
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").slice(0, 12) || "MISSING",
    SUPABASE_SERVICE_ROLE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY_PREFIX:
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 12) || "MISSING",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "MISSING",
    CRON_SECRET_SET: !!process.env.CRON_SECRET,
  };

  // 2. Prisma / DB
  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.broker.count();
    results.database = { ok: true, brokerCount: count };
  } catch (err) {
    results.database = { ok: false, error: String(err) };
  }

  // 3. Supabase server client (anon key)
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    results.supabaseAnon = {
      ok: !error,
      hasUser: !!data?.user,
      error: error?.message ?? null,
    };
  } catch (err) {
    results.supabaseAnon = { ok: false, error: String(err) };
  }

  // 4. Supabase admin client (service role key)
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 });
    results.supabaseAdmin = {
      ok: !error,
      userCount: data?.users?.length ?? 0,
      error: error?.message ?? null,
    };
  } catch (err) {
    results.supabaseAdmin = { ok: false, error: String(err) };
  }

  const allOk = Object.values(results).every(
    (r) => typeof r !== "object" || (r as Record<string, unknown>).ok !== false,
  );

  return NextResponse.json({ allOk, results }, { status: allOk ? 200 : 500 });
}
