"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppStatus {
  isWhatsappConnected: boolean;
  metaPhoneNumber: string | null;
  metaDisplayName: string | null;
}

export function WhatsAppConnect({ initial }: { initial: WhatsAppStatus }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<WhatsAppStatus>(initial);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [saving, setSaving] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, wabaId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to connect WhatsApp");
      }
      setStatus({
        isWhatsappConnected: true,
        metaPhoneNumber: json.data?.metaPhoneNumber ?? null,
        metaDisplayName: json.data?.metaDisplayName ?? null,
      });
      setPhoneNumberId("");
      setWabaId("");
      toast({ title: "WhatsApp connected", description: "Your number is now live." });
    } catch (err) {
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        {status.isWhatsappConnected ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-700">Connected</span>
            {status.metaPhoneNumber && (
              <span className="text-slate-500">
                · {status.metaPhoneNumber}
                {status.metaDisplayName ? ` (${status.metaDisplayName})` : ""}
              </span>
            )}
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-slate-400" />
            <span className="font-medium text-slate-600">Not connected</span>
          </>
        )}
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Open Meta Business Manager → WhatsApp → API Setup.</li>
        <li>Copy your <span className="font-medium">Phone Number ID</span>.</li>
        <li>Copy your <span className="font-medium">WhatsApp Business Account ID</span>.</li>
        <li>Paste both below and click Connect.</li>
      </ol>

      <form onSubmit={connect} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="phoneNumberId">Phone Number ID</Label>
          <Input
            id="phoneNumberId"
            inputMode="numeric"
            placeholder="e.g. 123456789012345"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value.trim())}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wabaId">WhatsApp Business Account ID</Label>
          <Input
            id="wabaId"
            inputMode="numeric"
            placeholder="e.g. 987654321098765"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value.trim())}
            required
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {status.isWhatsappConnected ? "Update connection" : "Connect"}
        </Button>
      </form>
    </div>
  );
}
