"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/client/api";

export interface Me {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  nexconnId: string;
}

export interface SpaceListItem {
  id: string;
  name: string;
  description: string;
  nexconnGroupId: string;
  role: "owner" | "member";
}

export interface Profile {
  kind: "user" | "agent";
  id: string;
  nexconnId: string;
  name: string;
  avatarUrl: string | null;
  handle: string | null;
}

interface AppDataValue {
  me: Me;
  setMe: (me: Me) => void;
  spaces: SpaceListItem[] | null;
  reloadSpaces: () => Promise<void>;
  profiles: Record<string, Profile>;
  addProfiles: (list: Profile[]) => void;
  ensureProfiles: (nexconnIds: string[]) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ initialMe, children }: { initialMe: Me; children: React.ReactNode }) {
  const [me, setMe] = useState(initialMe);
  const [spaces, setSpaces] = useState<SpaceListItem[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({
    [initialMe.nexconnId]: { kind: "user", id: initialMe.id, nexconnId: initialMe.nexconnId, name: initialMe.name, avatarUrl: initialMe.avatarUrl, handle: null },
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const requested = useRef(new Set<string>());
  const queue = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadSpaces = useCallback(async () => {
    const data = await api<{ spaces: SpaceListItem[] }>("/api/spaces");
    setSpaces(data.spaces);
  }, []);

  useEffect(() => {
    void reloadSpaces().catch(() => setSpaces([]));
  }, [reloadSpaces]);

  const addProfiles = useCallback((list: Profile[]) => {
    if (list.length === 0) return;
    setProfiles((prev) => {
      const next = { ...prev };
      for (const p of list) next[p.nexconnId] = p;
      return next;
    });
  }, []);

  const flush = useCallback(async () => {
    const ids = [...queue.current];
    queue.current.clear();
    timer.current = null;
    if (ids.length === 0) return;
    try {
      const data = await api<{ profiles: Profile[] }>(`/api/directory?ids=${ids.join(",")}`);
      addProfiles(data.profiles);
    } catch {
      ids.forEach((id) => requested.current.delete(id));
    }
  }, [addProfiles]);

  const ensureProfiles = useCallback(
    (ids: string[]) => {
      let added = false;
      for (const id of ids) {
        if (!id || requested.current.has(id)) continue;
        requested.current.add(id);
        queue.current.add(id);
        added = true;
      }
      if (added && !timer.current) timer.current = setTimeout(() => void flush(), 60);
    },
    [flush],
  );

  useEffect(() => {
    setProfiles((prev) => ({
      ...prev,
      [me.nexconnId]: { kind: "user", id: me.id, nexconnId: me.nexconnId, name: me.name, avatarUrl: me.avatarUrl, handle: null },
    }));
  }, [me]);

  const value = useMemo(
    () => ({ me, setMe, spaces, reloadSpaces, profiles, addProfiles, ensureProfiles, sidebarOpen, setSidebarOpen }),
    [me, spaces, reloadSpaces, profiles, addProfiles, ensureProfiles, sidebarOpen],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
