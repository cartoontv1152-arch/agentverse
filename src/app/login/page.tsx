import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClerkUserId } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/clerk-forms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getClerkUserId()) redirect(next);
  const joining = next.startsWith("/join/");
  return (
    <AuthLayout title="Welcome back" subtitle={joining ? "Log in and you'll go straight back to your invite." : "Log in to pick up where your spaces left off."}>
      <LoginForm next={next} />
    </AuthLayout>
  );
}
