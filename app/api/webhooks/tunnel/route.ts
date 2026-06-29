import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { url, secret } = await request.json();
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    // Initialize config table if it doesn't exist
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS _config (key TEXT PRIMARY KEY, value TEXT)`;

    // Update the OPENWA_URL
    await prisma.$executeRaw`INSERT INTO _config (key, value) VALUES ('OPENWA_URL', ${url}) ON CONFLICT (key) DO UPDATE SET value = ${url}`;

    return NextResponse.json({ success: true, url });
  } catch (err) {
    console.error("tunnel webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
