import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";

/**
 * Register a new broker: creates a Supabase auth user (email confirmed) and a
 * matching Broker row linked by authUserId. The client signs in afterwards.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = registerSchema.parse(body);

    const phone = normalizePhone(input.phone);
    if (!phone) return jsonError("Invalid Indian phone number", 422);

    const existing = await prisma.broker.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) return jsonError("An account with this email already exists", 409);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });

    if (error || !data.user) {
      return jsonError(error?.message ?? "Failed to create account", 400);
    }

    try {
      await prisma.broker.create({
        data: {
          authUserId: data.user.id,
          email: input.email,
          name: input.name,
          phone,
        },
      });
    } catch (dbErr) {
      // Roll back the orphaned auth user so the email can be reused.
      await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
      throw dbErr;
    }

    return jsonOk({ registered: true }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
