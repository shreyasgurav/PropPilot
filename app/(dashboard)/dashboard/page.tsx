import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, MessageCircle, Clock, TrendingUp, ArrowRight } from "lucide-react";
import { getCurrentBroker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { LeadStatusBadge, LeadSourceBadge } from "@/components/leads/LeadStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FollowUpStatus, LeadStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const broker = await getCurrentBroker();
  if (!broker) redirect("/login");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    leadsThisMonth,
    contactedToday,
    pendingFollowUps,
    totalLeads,
    closedLeads,
    recentLeads,
  ] = await Promise.all([
    prisma.lead.count({
      where: { brokerId: broker.id, createdAt: { gte: startOfMonth } },
    }),
    prisma.lead.count({
      where: { brokerId: broker.id, lastContactedAt: { gte: startOfToday } },
    }),
    prisma.followUpJob.count({
      where: {
        status: FollowUpStatus.PENDING,
        lead: { brokerId: broker.id },
      },
    }),
    prisma.lead.count({ where: { brokerId: broker.id } }),
    prisma.lead.count({
      where: { brokerId: broker.id, status: LeadStatus.CLOSED },
    }),
    prisma.lead.findMany({
      where: { brokerId: broker.id },
      include: { property: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const conversionRate =
    totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Leads this month" value={leadsThisMonth} icon={Users} />
        <StatsCard
          label="Contacted today"
          value={contactedToday}
          icon={MessageCircle}
        />
        <StatsCard
          label="Pending follow-ups"
          value={pendingFollowUps}
          icon={Clock}
        />
        <StatsCard
          label="Conversion rate"
          value={`${conversionRate}%`}
          icon={TrendingUp}
          hint={`${closedLeads} of ${totalLeads} closed`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent leads</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/leads">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center">
              <p className="text-sm text-slate-500">No leads yet.</p>
              <p className="mt-1 text-sm text-slate-400">
                Add a property and connect a portal to start receiving leads.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/properties">Add your first property</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between py-3 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {lead.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {lead.property?.title ?? "No property"} · {lead.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LeadSourceBadge source={lead.source} />
                    <LeadStatusBadge status={lead.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
