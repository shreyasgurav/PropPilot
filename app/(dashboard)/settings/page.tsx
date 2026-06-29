import { redirect } from "next/navigation";
import { getCurrentBroker } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/components/settings/CopyField";
import { WhatsAppConnect } from "@/components/settings/WhatsAppConnect";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const broker = await getCurrentBroker();
  if (!broker) redirect("/login");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
  const token = broker.webhookToken;
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "";

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
          <CardTitle>WhatsApp Business</CardTitle>
          <CardDescription>
            Connect your WhatsApp number so PropPilot can message prospects and
            receive their replies directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <WhatsAppConnect
            initial={{
              isWhatsappConnected: broker.isWhatsappConnected,
              waPhoneNumber: broker.waPhoneNumber,
              waPushName: broker.waPushName,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead integrations</CardTitle>
          <CardDescription>
            Point your portals here so leads flow into PropPilot automatically.
            Keep these URLs private — anyone with them can create leads on your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyField
            label="Inbound email (forward portal lead emails here)"
            value={`a0bfccf66edceffa79e4+${token}@cloudmailin.net`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
