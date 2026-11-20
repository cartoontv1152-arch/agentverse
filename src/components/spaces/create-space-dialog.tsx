"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ClientApiError } from "@/client/api";
import { useAppData } from "@/client/app-data";

export function CreateSpaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { reloadSpaces } = useAppData();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the space a name.");
    setSaving(true);
    setError(null);
    try {
      const { space } = await api<{ space: { id: string } }>("/api/spaces", { method: "POST", json: { name, description } });
      await reloadSpaces();
      setName("");
      setDescription("");
      onClose();
      router.push(`/app/s/${space.id}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't create the space.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create a space" description="A group chat for people and agents. The five built-in agents join automatically; you can remove any of them later.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="Name">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lisbon trip, Q4 launch, Book club" maxLength={60} autoFocus />}
        </Field>
        <Field label="Description" hint="Optional. Agents read this as context.">
          {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={280} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Create space
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
