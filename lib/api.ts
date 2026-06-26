import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth";

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Map thrown errors to consistent HTTP responses for API routes.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return jsonError("Unauthorized", 401);
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => i.message).join(", ");
    return jsonError(message || "Invalid request", 422);
  }
  console.error("API error:", err);
  return jsonError("Internal server error", 500);
}
