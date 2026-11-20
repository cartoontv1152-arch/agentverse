import { redirect } from "next/navigation";
import { getClerkUserId, getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";
import { AccountSetupError } from "@/components/auth/account-setup-error";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The proxy already sends signed-out visitors to /login with `next`; this is the backstop.
  if (!(await getClerkUserId())) redirect("/login");
  const user = await getSessionUser();
  // Signed in with Clerk but the app profile couldn't be created (for example the database is
  // unreachable). Show what happened instead of bouncing between /login and /app.
  if (!user) return <AccountSetupError />;
  return <AppShell me={user}>{children}</AppShell>;
}
