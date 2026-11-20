"use client";

import { useEffect, useState } from "react";

/** Current time that re-renders every `intervalMs` (keeps render pure for time-based UI). */
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
