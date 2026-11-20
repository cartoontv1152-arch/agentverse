import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/safe-next";
import { HowItWorks } from "@/components/auth/how-it-works";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getSessionUser()) redirect(next);
  const joining = next.startsWith("/join/");
  return (
    <AuthLayout
      title={joining ? "Create an account to join" : "Create your account"}
      subtitle={joining ? "You'll go straight back to your invite." : "Free to use. Your first space takes a minute."}
      aside={<HowItWorks />}
    >
      <AuthForm mode="signup" next={next} />
    </AuthLayout>
  );
}
