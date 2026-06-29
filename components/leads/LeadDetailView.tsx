"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Send, Ban, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LeadStatusBadge,
  LeadSourceBadge,
  LEAD_STATUS_OPTIONS,
} from "@/components/leads/LeadStatusBadge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  FollowUpStatus,
  LeadStatus,
  MessageDirection,
} from "@prisma/client";
import type { LeadDetail } from "@/types";

export function LeadDetailView({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    if (res.ok) {
      const data = json.data as LeadDetail;
      setLead(data);
      setNotes(data.notes ?? "");
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateLead(payload: Record<string, unknown>, successMsg: string) {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Update failed", description: json.error });
      return;
    }
    toast({ title: successMsg });
    await load();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not send",
          description: json.error,
        });
        return;
      }
      setMessage("");
      await load();
    } finally {
      setSending(false);
    }
  }

  async function cancelFollowUps() {
    const res = await fetch(`/api/leads/${leadId}/cancel-followups`, {
      method: "POST",
    });
    if (res.ok) {
      toast({ title: "Pending follow-ups cancelled" });
      await load();
    }
  }

  async function deleteLead() {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast({ title: "Lead deleted" });
      router.push("/leads");
      router.refresh();
    } else {
      const json = await res.json();
      toast({ variant: "destructive", title: "Failed to delete lead", description: json.error });
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading lead…</p>;
  }
  if (notFound || !lead) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Lead not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/leads">
            <ArrowLeft className="h-4 w-4" /> Back to leads
          </Link>
        </Button>
      </div>
    );
  }

  const pendingFollowUps = lead.followUpJobs.filter(
    (j) => j.status === FollowUpStatus.PENDING,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/leads">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={deleteLead}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <a href={`tel:${lead.phone}`}>
            <Button variant="outline" size="sm">
              <Phone className="h-4 w-4" /> Call {lead.phone}
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{lead.name}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">{lead.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <LeadSourceBadge source={lead.source} />
                  <LeadStatusBadge status={lead.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Property</p>
                <p className="font-medium text-slate-800">
                  {lead.property?.title ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Budget</p>
                <p className="font-medium text-slate-800">{lead.budget ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-400">Created</p>
                <p className="font-medium text-slate-800">
                  {format(new Date(lead.createdAt), "dd MMM yyyy, h:mm a")}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Last contacted</p>
                <p className="font-medium text-slate-800">
                  {lead.lastContactedAt
                    ? format(new Date(lead.lastContactedAt), "dd MMM, h:mm a")
                    : "Not yet"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.messages.length === 0 ? (
                <p className="text-sm text-slate-400">No messages yet.</p>
              ) : (
                <div className="space-y-3">
                  {lead.messages.map((m) => {
                    const outbound = m.direction === MessageDirection.OUTBOUND;
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", outbound ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                            outbound
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-800",
                          )}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              outbound ? "text-emerald-100" : "text-slate-400",
                            )}
                          >
                            {format(new Date(m.sentAt), "dd MMM, h:mm a")}
                            {m.status === "failed" && " · failed"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={sendMessage} className="mt-4 flex items-center gap-2">
                <Input
                  placeholder="Type a WhatsApp message…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button type="submit" disabled={sending || !message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={lead.status}
                onValueChange={(value) =>
                  updateLead({ status: value as LeadStatus }, "Status updated")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Follow-ups</CardTitle>
              {pendingFollowUps.length > 0 && (
                <Button variant="outline" size="sm" onClick={cancelFollowUps}>
                  <Ban className="h-4 w-4" /> Cancel
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {lead.followUpJobs.length === 0 ? (
                <p className="text-sm text-slate-400">No follow-ups scheduled.</p>
              ) : (
                lead.followUpJobs.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-600">Day {j.day}</span>
                    <span className="text-slate-400">
                      {format(new Date(j.scheduledAt), "dd MMM")} · {j.status.toLowerCase()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="notes" className="sr-only">
                Notes
              </Label>
              <Textarea
                id="notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Private notes about this lead…"
              />
              <Button
                size="sm"
                onClick={() => updateLead({ notes }, "Notes saved")}
              >
                Save notes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
