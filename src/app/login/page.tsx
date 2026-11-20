import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/safe-next";
import { HowItWorks } from "@/components/auth/how-it-works";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getSessionUser()) redirect(next);
  return (
    <AuthLayout title="Log in" subtitle="Pick up where your spaces left off." aside={<HowItWorks />}>
      <AuthForm mode="login" next={next} />
    </AuthLayout>
  );
}
