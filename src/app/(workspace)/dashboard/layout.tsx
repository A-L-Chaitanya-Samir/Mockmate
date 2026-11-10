import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAccount } from "@/lib/supabase/server";
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAccount();
  return <AppShell>{children}</AppShell>;
}
