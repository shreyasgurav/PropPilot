# PropPilot

WhatsApp lead automation for real estate brokers. When a lead arrives from
99acres / MagicBricks / Housing, PropPilot instantly sends a personalized
WhatsApp message, schedules Day 1 / 3 / 7 follow-ups, and hands the conversation
back to the broker the moment the prospect replies.

## Stack

- **Next.js 14** (App Router) + **TypeScript** (strict)
- **PostgreSQL** (Supabase) + **Prisma**
- **Supabase Auth** (email/password)
- **Meta WhatsApp Business API** (Cloud API) for WhatsApp send/receive — we own the infrastructure
- **Postmark Inbound** for parsing portal lead emails
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

See `.env.example`. You need a Supabase project (Postgres + Auth), a Meta app
with the WhatsApp product (App ID/Secret + a permanent System User access
token), and a Postmark inbound server. `CRON_SECRET` secures the job endpoint.

### Connecting a broker's WhatsApp number

We run one verified Meta WhatsApp Business Account; each broker connects their
own number under it. In **Settings**, the broker pastes their **Phone Number
ID** and **WhatsApp Business Account ID** (from Meta → WhatsApp → API Setup) and
clicks Connect. Set the webhook **Callback URL** (`/api/webhooks/meta`) and
**Verify token** (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`) in the Meta dashboard.

## How leads flow in

Each broker gets a private `webhookToken` (see **Settings** in the app). Point
your sources at:

| Source | Endpoint |
| --- | --- |
| 99acres webhook | `POST /api/webhooks/99acres?token=<token>` |
| MagicBricks webhook | `POST /api/webhooks/magicbricks?token=<token>` |
| Portal lead emails | forward to `leads+<token>@inbound.proppilot.app` (Postmark) |
| WhatsApp inbound replies | `GET`/`POST /api/webhooks/meta` (Meta Cloud API; matched by Phone Number ID) |

Webhook JSON bodies are flexible — the parser looks for `name`, `phone`,
`budget`, `property`, etc. Phone numbers are normalized to `+91XXXXXXXXXX`.

### Test a lead locally

```bash
curl -X POST "http://localhost:3000/api/webhooks/99acres?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Rahul","phone":"9812345678","budget":"₹80-90L","property":"2BHK in Powai"}'
```

## Scheduled follow-ups

`scheduleFollowUps()` enqueues Day 1/3/7 jobs in pg-boss. The cron endpoint
`/api/jobs/process` drains due jobs every minute (configured in `vercel.json`).
It is protected by `Authorization: Bearer <CRON_SECRET>`, which Vercel Cron
sends automatically.

> Vercel Cron at one-minute cadence requires a Pro plan. On Hobby, lower the
> cadence in `vercel.json` or trigger `/api/jobs/process` from an external
> scheduler (e.g. cron-job.org) with the bearer secret.

When a prospect replies (Meta inbound webhook), all pending follow-ups are
cancelled, the lead moves to `INTERESTED`, and the broker is pinged on WhatsApp.

## Key design points

- **Multi-tenancy:** every query is scoped by `brokerId` from the Supabase session.
- **Deduplication:** same phone + property within 24h updates the existing lead.
- **Rate limiting:** at most one outbound WhatsApp per lead per day.
- **Failure handling:** failed sends are recorded as `failed` messages and pg-boss retries.

## Deploy

App on Vercel, database on Supabase. Set all env vars in Vercel, then deploy.
`npm run build` runs `prisma generate` automatically.
