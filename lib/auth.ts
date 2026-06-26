import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Broker } from "@prisma/client";

/**
 * Resolve the authenticated broker for the current request.
 * Returns null if there is no valid session or no matching Broker row.
 *
 * Every data-access path in the app should call this and scope queries by
 * the returned broker.id to enforce multi-tenancy.
 */
export async function getCurrentBroker(): Promise<Broker | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const broker = await prisma.broker.findUnique({
      where: { authUserId: user.id },
    });

    return broker;
  } catch (err) {
    console.error("getCurrentBroker failed:", err);
    return null;
  }
}

/**
 * Like getCurrentBroker but throws an Error when unauthenticated.
 * Convenient inside API route handlers wrapped in try/catch.
 */
export async function requireBroker(): Promise<Broker> {
  const broker = await getCurrentBroker();
  if (!broker) {
    throw new UnauthorizedError();
  }
  return broker;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
