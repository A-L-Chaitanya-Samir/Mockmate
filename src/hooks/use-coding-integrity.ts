"use client";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useDemoStore } from "@/stores/demo-store";
import { createIntegrityEvent } from "@/services/coding-service";
import type { IntegrityEventType } from "@/types/coding";
export function useCodingIntegrity(roundId: string, enabled: boolean) {
  const saveEvent = useDemoStore((s) => s.recordIntegrityEvent);
  const record = useCallback(
    (type: IntegrityEventType, detail: string) => {
      if (!enabled) return;
      saveEvent(roundId, createIntegrityEvent(type, detail));
      toast.warning(detail, {
        description:
          "Recorded locally for transparent review. This event alone does not imply misconduct.",
        id: `integrity-${type}`,
      });
    },
    [roundId, enabled, saveEvent],
  );
  useEffect(() => {
    if (!enabled) return;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(focusTimer);
        record("tab-hidden", "The coding interview tab was left or hidden.");
      } else if (document.visibilityState === "visible") {
        toast.info(
          "You’re back in the coding round. Any visibility change is listed in the integrity panel.",
          { id: "integrity-return" },
        );
      }
    };
    // Delay a visible-window blur to avoid counting one tab switch twice.
    const blur = () => {
      focusTimer = setTimeout(() => {
        if (document.visibilityState === "visible" && !document.hasFocus())
          record("focus-lost", "The interview window lost focus.");
      }, 200);
    };
    const focus = () => clearTimeout(focusTimer);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
    };
  }, [enabled, record]);
  return record;
}
