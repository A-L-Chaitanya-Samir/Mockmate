"use client";
import { useEffect, useState } from "react";
import { useDemoStore } from "@/stores/demo-store";
import { currentDemoUsage, interviewAllowance } from "@/config/usage";
export function useUsage() {
  const usage = useDemoStore((s) => s.usage);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const sync = (event: StorageEvent) => {
      if (event.key === "mockmate-demo-v1" && event.newValue) {
        try {
          const next = JSON.parse(event.newValue).state?.usage;
          const current = useDemoStore.getState().usage;
          if (
            next &&
            (next.startedAt !== current.startedAt ||
              next.resumes !== current.resumes ||
              next.interviews !== current.interviews)
          ) {
            void useDemoStore.persist.rehydrate();
          }
        } catch {
          /* A corrupt external save is ignored. */
        }
        refresh();
      }
    };
    window.addEventListener("storage", sync);
    const timer = setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const current = currentDemoUsage(usage, now);
  return {
    interviews: interviewAllowance(current.interviews),
    resumes: { limit: 10, remaining: Math.max(0, 10 - current.resumes) },
    resetAt: current.startedAt === null ? null : current.startedAt + 86400000,
  };
}
