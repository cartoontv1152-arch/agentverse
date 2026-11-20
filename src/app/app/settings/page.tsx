"use client";

import { useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { api, ClientApiError, useResource } from "@/client/api";
import { useAppData, type Me } from "@/client/app-data";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const { me, setMe } = useAppData();
  const { push } = useToast();
  const usage = useResource<{ usage: { user: { used: number; limit: number } } }>("/api/me");
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
  return (
    <>
      <PageHeader>
        <h1 className="text-base font-semibold">Profile settings</h1>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-8 sm:px-8">
          <section className="flex items-center gap-4">
            <Avatar name={me.name} src={me.avatarUrl} size="xl" />
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Upload photo" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                {!uploading ? <ImageUp aria-hidden className="size-4" /> : null} Change photo
              </Button>
              {me.avatarUrl ? (
                <button type="button" className="text-left text-xs text-ink/55 hover:text-ink" onClick={() => save({ avatarUrl: null }, "Photo removed.")}>
                  Remove photo
                </button>
              ) : null}
            </div>
          </section>
          <form
            className="flex flex-col gap-4"
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
            <Field label="Email">{(p) => <Input {...p} value={me.email} disabled readOnly />}</Field>
            <Button type="submit" variant="primary" loading={saving} disabled={!name.trim() || name.trim() === me.name} className="self-start">
              Save name
            </Button>
          </form>
          <section>
            <h2 className="text-sm font-semibold">Agent usage</h2>
            <p className="mt-1 text-sm text-ink/60">
              {u ? `You've used ${u.used} of ${u.limit} agent replies this hour.` : "Loading usage…"} Limits keep the shared AI quota fair for everyone.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
