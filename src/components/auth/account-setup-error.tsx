"use client";

import { useClerk } from "@clerk/nextjs";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export function AccountSetupError() {
  const { signOut } = useClerk();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold">We couldn&apos;t finish setting up your account</h1>
      <p className="mt-2 max-w-md text-ink/65">
        You&apos;re signed in, but your AgentVerse profile wasn&apos;t created. This is usually a brief outage. Reload in a moment, or sign out and try again.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button variant="secondary" onClick={() => void signOut({ redirectUrl: "/login" })}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
