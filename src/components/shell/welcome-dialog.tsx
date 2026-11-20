"use client";

import { useState } from "react";
import { api, ClientApiError } from "@/client/api";
import { useAppData, type Me } from "@/client/app-data";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * First visit after sign-up: Clerk may not collect a name, so ask once what people should call
 * this person. The name is shown to everyone in their spaces and used by agents.
 */
export function WelcomeDialog() {
  const { me, setMe } = useAppData();
  const [name, setName] = useState(me.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (me.nameConfirmed) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return setError("Enter the name people should see.");
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ user: Me }>("/api/me", { method: "PATCH", json: { name: value } });
      setMe({ ...me, ...res.user, nameConfirmed: true });
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't save your name. Try again.");
      setSaving(false);
    }
  }

  return (
    // Closing without a name keeps the suggested one; the dialog won't return after saving.
    <Dialog open onClose={() => setMe({ ...me, nameConfirmed: true })} title="Welcome to AgentVerse" description="What should people and agents call you? You can change it later in settings.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="Your name">{(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="name" />}</Field>
        <Button type="submit" variant="primary" size="lg" loading={saving} className="w-full">
          Continue
        </Button>
      </form>
    </Dialog>
  );
}
