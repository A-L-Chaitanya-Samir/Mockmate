"use client";
import { useSyncExternalStore } from "react";
import { useDemoStore } from "@/stores/demo-store";
const subscribe = (notify: () => void) =>
  useDemoStore.persist.onFinishHydration(notify);
/** Forms must mount after persistence loads, so defaultValues use saved preferences. */
export function useDemoReady() {
  return useSyncExternalStore(
    subscribe,
    () => useDemoStore.persist.hasHydrated(),
    () => false,
  );
}
