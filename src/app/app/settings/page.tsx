"use client";

import { useRef, useState } from "react";
import { ImageUp, ShieldCheck } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { api, ClientApiError, useResource } from "@/client/api";
import { useAppData, type Me } from "@/client/app-data";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-ink/8 py-8 first:border-t-0 first:pt-0 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink/55">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { me, setMe } = useAppData();
  const { push } = useToast();
  const clerk = useClerk();
  const usage = useResource<{ usage: { user: { used: number; limit: number; resetsAt: string | null } } }>("/api/me");
  const [name, setName] = useState(me.name);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(patch: Partial<Pick<Me, "name" | "avatarUrl">>, message: string) {
    try {
      const res = await api<{ user: Me }>("/api/me", { method: "PATCH", json: patch });
      setMe({ ...me, ...res.user });
      push(message, "success");
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Couldn't save.", "error");
    }
  }

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) return push("Images must be 2 MB or smaller.", "error");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed.");
      await save({ avatarUrl: data.url }, "Photo updated.");
    } catch (err) {
      push(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  const u = usage.data?.usage.user;
  const pct = u ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;

  return (
    <>
      <PageHeader>
        <PageTitle title="Profile settings" />
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
          <Section title="Profile" description="How people and agents see you in every space.">
            <div className="flex items-center gap-5">
              <Avatar name={me.name} src={me.avatarUrl} size="xl" />
              <div className="flex flex-col items-start gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Upload photo" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                  {!uploading ? <ImageUp aria-hidden className="size-4" /> : null} Change photo
                </Button>
                {me.avatarUrl ? (
                  <button type="button" className="text-xs font-medium text-ink/55 hover:text-ink" onClick={() => save({ avatarUrl: null }, "Photo removed.")}>
                    Remove photo
                  </button>
                ) : (
                  <p className="text-2xs text-ink/45">PNG, JPG, WebP or GIF up to 2 MB.</p>
                )}
              </div>
            </div>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                setSaving(true);
                await save({ name: name.trim() }, "Name updated.");
                setSaving(false);
              }}
            >
              <Field label="Display name" hint="People and agents see this name.">
                {(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
              </Field>
              <Button type="submit" variant="primary" loading={saving} disabled={!name.trim() || name.trim() === me.name} className="self-start">
                Save name
              </Button>
            </form>
          </Section>

          <Section title="Account and security" description="Sign-in is handled by Clerk.">
            <div className="rounded-panel border border-ink/8 p-4">
              <p className="text-sm text-ink/60">Signed in as</p>
              <p className="font-semibold">{me.email}</p>
              <p className="mt-3 text-sm text-ink/60">Change your email or password, connect Google, or sign out of other devices.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => clerk.openUserProfile()}>
                  <ShieldCheck aria-hidden className="size-4" /> Manage account
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Agent usage" description="Limits keep the shared AI quota fair for everyone.">
            {u ? (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm">Agent replies this hour</p>
                  <p className={`font-display text-lg font-semibold tabular-nums ${pct >= 80 ? "text-signal" : ""}`}>
                    {u.used} <span className="text-sm font-normal text-ink/45">of {u.limit}</span>
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/6" role="meter" aria-valuenow={u.used} aria-valuemin={0} aria-valuemax={u.limit} aria-label="Agent replies this hour">
                  <div className={`h-full rounded-full transition-[width] duration-500 ${pct >= 80 ? "bg-signal" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                </div>
                {u.resetsAt && pct >= 80 ? (
                  <p className="mt-2 text-xs text-ink/55">Frees up from {new Date(u.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</p>
                ) : null}
              </div>
            ) : (
              <div className="skeleton h-12 rounded-control" />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
