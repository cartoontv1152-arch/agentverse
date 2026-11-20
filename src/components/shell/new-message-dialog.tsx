"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/field";
import { api } from "@/client/api";
import { useAppData, type Profile } from "@/client/app-data";

interface Contact {
  id: string;
  name: string;
  avatarUrl: string | null;
  nexconnId: string;
}

export function NewMessageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { addProfiles } = useAppData();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    api<{ contacts: Contact[] }>("/api/contacts")
      .then((d) => {
        setContacts(d.contacts);
        addProfiles(d.contacts.map((c): Profile => ({ kind: "user", id: c.id, nexconnId: c.nexconnId, name: c.name, avatarUrl: c.avatarUrl, handle: null })));
      })
      .catch(() => setContacts([]));
  }, [open, addProfiles]);

  const filtered = (contacts ?? []).filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Dialog open={open} onClose={onClose} title="New direct message" description="You can message anyone who shares a space with you.">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
        <Input aria-label="Search people" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" className="pl-9" autoFocus />
      </div>
      <ul className="mt-3 flex max-h-72 flex-col gap-0.5 overflow-y-auto">
        {contacts === null ? (
          <li className="px-2 py-3 text-sm text-ink/50">Loading people…</li>
        ) : filtered.length === 0 ? (
          <li className="px-2 py-3 text-sm text-ink/55">
            {contacts.length === 0 ? "No one to message yet. Invite people to a space first." : "No one matches that name."}
          </li>
        ) : (
          filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/app/dm/${c.nexconnId}`);
                }}
                className="flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-colors hover:bg-paper"
              >
                <Avatar name={c.name} src={c.avatarUrl} size="sm" />
                <span className="text-sm font-semibold">{c.name}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Dialog>
  );
}
