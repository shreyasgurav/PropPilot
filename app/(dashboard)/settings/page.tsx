import { redirect } from "next/navigation";
import { getCurrentBroker } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/components/settings/CopyField";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const broker = await getCurrentBroker();
  if (!broker) redirect("/login");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
  const token = broker.webhookToken;

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your broker profile details.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Name</p>
            <p className="font-medium text-slate-800">{broker.name}</p>
          </div>
          <div>
            <p className="text-slate-400">Email</p>
            <p className="font-medium text-slate-800">{broker.email}</p>
          </div>
          <div>
            <p className="text-slate-400">WhatsApp number</p>
            <p className="font-medium text-slate-800">{broker.phone}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead integrations</CardTitle>
          <CardDescription>
            Point your portals here so leads flow into BrokerPulse automatically.
            Keep these URLs private — anyone with them can create leads on your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyField
            label="99acres webhook URL"
            value={`${appUrl}/api/webhooks/99acres?token=${token}`}
          />
          <CopyField
            label="MagicBricks webhook URL"
            value={`${appUrl}/api/webhooks/magicbricks?token=${token}`}
          />
          <CopyField
            label="Inbound email (forward portal lead emails here)"
            value={`leads+${token}@inbound.brokerpulse.app`}
          />
          <CopyField
            label="WATI incoming-message webhook"
            value={`${appUrl}/api/webhooks/wati?token=${token}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
