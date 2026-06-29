"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  QrCode,
  Unplug,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ConnectionState =
  | "disconnected"
  | "creating"
  | "loading_qr"
  | "showing_qr"
  | "waiting"
  | "connected";

interface WhatsAppStatus {
  isWhatsappConnected: boolean;
  waPhoneNumber: string | null;
  waPushName: string | null;
}

export function WhatsAppConnect({ initial }: { initial: WhatsAppStatus }) {
  const { toast } = useToast();
  const [state, setState] = useState<ConnectionState>(
    initial.isWhatsappConnected ? "connected" : "disconnected",
  );
  const [phone, setPhone] = useState(initial.waPhoneNumber);
  const [pushName, setPushName] = useState(initial.waPushName);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount.
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data;

        if (data.isWhatsappConnected) {
          if (pollRef.current) clearInterval(pollRef.current);
          setState("connected");
          setPhone(data.phone ?? null);
          setPushName(data.pushName ?? null);
          setQrCode(null);
          toast({
            title: "WhatsApp Connected! 🎉",
            description: `Linked to ${data.pushName ?? data.phone ?? "your phone"}`,
          });
        } else if (data.status === "qr_ready" && state !== "showing_qr") {
          // QR rotated, refetch it.
          fetchQR();
        }
      } catch {
        // Silently ignore network errors during polling.
      }
    }, 3000);
  }, [state, toast]);

  async function fetchQR() {
    setState("loading_qr");
    try {
      const res = await fetch("/api/whatsapp/qr");
      if (!res.ok) {
        // QR not ready yet, keep polling.
        setState("waiting");
        return;
      }
      const json = await res.json();
      setQrCode(json.data?.qrCode ?? null);
      setState("showing_qr");
    } catch {
      setState("waiting");
    }
  }

  async function handleConnect() {
    setState("creating");
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create session");
      }
      // Give OpenWA a moment to boot, then fetch QR.
      await new Promise((r) => setTimeout(r, 2000));
      await fetchQR();
      startPolling();
    } catch (err) {
      setState("disconnected");
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect WhatsApp? Automated messages will stop until you reconnect.")) return;
    setDisconnecting(true);
    try {
      if (pollRef.current) clearInterval(pollRef.current);
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to disconnect");
      }
      setState("disconnected");
      setPhone(null);
      setPushName(null);
      setQrCode(null);
      toast({ title: "WhatsApp disconnected" });
    } catch (err) {
      toast({
        title: "Disconnect failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  // ─── Connected State ────────────────────────────────────────────
  if (state === "connected") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="font-semibold text-emerald-800">WhatsApp Connected</p>
            <p className="truncate text-sm text-emerald-600">
              {pushName ? `${pushName} · ` : ""}
              {phone ?? "Phone linked"}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Your WhatsApp is linked. Automated lead messages and follow-ups will
          be sent through your phone. You can continue using WhatsApp normally.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-red-600 hover:text-red-700"
        >
          {disconnecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Unplug className="mr-2 h-4 w-4" />
          )}
          Disconnect
        </Button>
      </div>
    );
  }

  // ─── QR Code State ──────────────────────────────────────────────
  if (state === "showing_qr" && qrCode) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-slate-200 bg-white p-6">
          <div className="rounded-lg bg-white p-2 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt="WhatsApp QR Code"
              className="h-56 w-56"
            />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-800">Scan this QR Code</p>
            <p className="mt-1 text-sm text-slate-500">
              Open <span className="font-medium">WhatsApp</span> on your phone →{" "}
              <span className="font-medium">Settings</span> →{" "}
              <span className="font-medium">Linked Devices</span> →{" "}
              <span className="font-medium">Link a Device</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for you to scan...
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchQR()}
          className="w-full text-slate-500"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh QR Code
        </Button>
      </div>
    );
  }

  // ─── Loading / Creating State ───────────────────────────────────
  if (state === "creating" || state === "loading_qr" || state === "waiting") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm font-medium text-slate-600">
          {state === "creating"
            ? "Setting up your WhatsApp session..."
            : "Loading QR code..."}
        </p>
      </div>
    );
  }

  // ─── Disconnected State ─────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="rounded-full bg-slate-100 p-3">
          <Smartphone className="h-6 w-6 text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-700">Connect WhatsApp</p>
          <p className="mt-1 text-sm text-slate-500">
            Link your phone by scanning a QR code — just like WhatsApp Web.
            <br />
            You keep using the normal WhatsApp app on your phone.
          </p>
        </div>
        <Button onClick={handleConnect} className="mt-2">
          <QrCode className="mr-2 h-4 w-4" />
          Connect with QR Code
        </Button>
      </div>

      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
        <p className="font-medium">How it works:</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-blue-600">
          <li>Click &quot;Connect with QR Code&quot; above</li>
          <li>Open WhatsApp on your phone → Settings → Linked Devices</li>
          <li>Tap &quot;Link a Device&quot; and scan the QR code shown here</li>
          <li>Done! PropPilot will send automated messages through your number</li>
        </ol>
      </div>
    </div>
  );
}
