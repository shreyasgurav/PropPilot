import Link from "next/link";
import { ArrowRight, Clock, MessageSquare, BarChart3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Zap,
    title: "Instant first contact",
    body: "Every lead from 99acres, MagicBricks and Housing gets a personalized WhatsApp within 60 seconds — automatically.",
  },
  {
    icon: Clock,
    title: "Follow-ups that never slip",
    body: "Day 1, Day 3 and Day 7 nudges fire on their own. Stop losing deals because nobody followed up.",
  },
  {
    icon: MessageSquare,
    title: "You take over when they reply",
    body: "The moment a prospect responds, follow-ups stop and you get pinged on WhatsApp to close the deal.",
  },
  {
    icon: BarChart3,
    title: "One clean dashboard",
    body: "See every lead, its status and full message history. Know exactly which leads are hot.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">
          Broker<span className="text-emerald-600">Pulse</span>
        </span>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        <section className="flex flex-col items-start gap-6 py-20 md:py-28">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            WhatsApp lead automation for real estate brokers
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Never miss a property lead again.
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            80% of buyers go with whoever replies first. BrokerPulse answers
            every lead in under a minute and follows up for you — so you only
            spend time on prospects who are ready to talk.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/register">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 pb-24 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-200 p-6"
            >
              <f.icon className="h-5 w-5 text-emerald-600" />
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {f.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-sm text-slate-500">
          © {new Date().getFullYear()} BrokerPulse. Built for Mumbai brokers.
        </div>
      </footer>
    </div>
  );
}
