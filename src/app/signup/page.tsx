import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClerkUserId } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignupForm } from "@/components/auth/clerk-forms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getClerkUserId()) redirect(next);
  const joining = next.startsWith("/join/");
  return (
    <AuthLayout
      title={joining ? "Create an account to join" : "Create your account"}
      subtitle={joining ? "You'll go straight back to your invite." : "Free to use. Your first space takes under a minute."}
    >
      <SignupForm next={next} />
    </AuthLayout>
  );
}
