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
    <AuthLayout note={joining ? "Create an account and you'll go straight back to your invite." : undefined}>
      <SignupForm next={next} />
    </AuthLayout>
  );
}
