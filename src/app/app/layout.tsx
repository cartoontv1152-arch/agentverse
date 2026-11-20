import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "/app";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return <AppShell me={user}>{children}</AppShell>;
}
