# PropPilot

WhatsApp lead automation for real estate brokers. When a lead arrives from
99acres / MagicBricks / Housing, PropPilot instantly sends a personalized
WhatsApp message, schedules Day 1 / 3 / 7 follow-ups, and hands the conversation
back to the broker the moment the prospect replies.

## Stack

- **Next.js 14** (App Router) + **TypeScript** (strict)
- **PostgreSQL** (Supabase) + **Prisma**
- **Supabase Auth** (email/password)
- **OpenWA (Baileys Engine)** self-hosted on a VPS for WhatsApp send/receive (acts as WhatsApp Web, no Meta fees)
- **Cloudmailin** for parsing portal lead inbound emails
- **pg-boss** (Postgres job queue) for scheduled follow-ups, drained by a Vercel Cron
- **Tailwind CSS** + **shadcn/ui**

## Getting started

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env   # then fill in real values

# 3. Create the database schema
npm run db:push

# 4. (optional) Seed demo data for local development
npm run db:seed

# 5. Run
npm run dev
```

Open http://localhost:3000 and register a broker account.

## Environment variables

See `.env.example`. You need a Supabase project (Postgres + Auth), an OpenWA instance (self-hosted via Docker), and a Cloudmailin target. `CRON_SECRET` secures the job endpoint.

### Connecting a broker's WhatsApp number

We use OpenWA with the Baileys engine. In **Settings**, the broker clicks **Connect with QR code** and scans it using their WhatsApp app (Linked Devices). 
Behind the scenes, PropPilot talks to the OpenWA API to create an isolated session and registers a webhook back to Vercel so we receive inbound replies. We also dynamically sync Cloudflare Tunnel URLs via the `/api/webhooks/tunnel` endpoint to ensure stable connectivity to the self-hosted OpenWA instance.

## How leads flow in

Each broker gets a private Cloudmailin email address (see **Settings** in the app). Point your sources at:

| Source | Endpoint |
| --- | --- |
| Portal lead emails | forward to `<your-cloudmailin-address>+<token>@cloudmailin.net` |
| WhatsApp inbound replies | `POST /api/webhooks/openwa` (Sent automatically by OpenWA) |

Webhook JSON bodies are flexible — the parser looks for `name`, `phone`, `budget`, `property`, etc. Phone numbers are normalized to `+91XXXXXXXXXX`.

## Scheduled follow-ups

`scheduleFollowUps()` enqueues Day 1/3/7 jobs in pg-boss. The cron endpoint `/api/jobs/process` drains due jobs every minute (configured in `vercel.json`).
It is protected by `Authorization: Bearer <CRON_SECRET>`, which Vercel Cron sends automatically.

When a prospect replies (OpenWA inbound webhook), all pending follow-ups are
cancelled, the lead moves to `INTERESTED`, and the broker is pinged on WhatsApp.

## Key design points

- **Multi-tenancy:** every query is scoped by `brokerId` from the Supabase session.
- **Deduplication:** same phone + property within 24h updates the existing lead.
- **Rate limiting:** at most one outbound WhatsApp per lead per day.
- **Dynamic Routing:** Vercel automatically updates its OpenWA connection URL via a tunnel sync script running on the VPS.

## Deploy

App on Vercel, database on Supabase. OpenWA on a cheap VPS ($5/mo).
`npm run build` runs `prisma generate` automatically.
