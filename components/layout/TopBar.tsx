"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  brokerName: string;
}

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/properties")) return "Properties";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

export function TopBar({ brokerName }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const title = titleForPath(pathname);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-slate-600 sm:inline">
          {brokerName}
        </span>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
