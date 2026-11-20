"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormError, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ClientApiError } from "@/client/api";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (mode === "signup" && !name.trim()) errs.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (mode === "signup" && password.length < 8) errs.password = "Use at least 8 characters.";
    if (mode === "login" && !password) errs.password = "Enter your password.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: mode === "signup" ? { name, email, password } : { email, password } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        const field = err.details?.field;
        if (typeof field === "string") setFieldErrors({ [field]: err.message });
        else setError(err.message);
      } else setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  const otherHref = `${mode === "login" ? "/signup" : "/login"}${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />
      {mode === "signup" ? (
        <Field label="Your name" error={fieldErrors.name} hint="Shown to people and agents in your spaces.">
          {(p) => <Input {...p} name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />}
        </Field>
      ) : null}
      <Field label="Email" error={fieldErrors.email}>
        {(p) => (
          <Input {...p} name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={mode === "login"} />
        )}
      </Field>
      <Field label="Password" error={fieldErrors.password} hint={mode === "signup" ? "At least 8 characters." : undefined}>
        {(p) => (
          <Input
            {...p}
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-1 w-full">
        {mode === "signup" ? "Create account" : "Log in"}
      </Button>
      <p className="text-center text-sm text-ink/60">
        {mode === "signup" ? "Already have an account? " : "New to AgentVerse? "}
        <Link href={otherHref} className="font-medium text-accent underline-offset-2 hover:underline">
          {mode === "signup" ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
