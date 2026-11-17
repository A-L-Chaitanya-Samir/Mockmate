import type { StateStorage } from "zustand/middleware";
import { toast } from "sonner";
let warned = false;
const fallback = new Map<string, string>();
export const demoStorage: StateStorage = {
  getItem(key) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) JSON.parse(value);
      return value;
    } catch {
      return fallback.get(key) ?? null;
    }
  },
  setItem(key, value) {
    fallback.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      if (!warned) {
        warned = true;
        toast.warning(
          "Browser storage is unavailable or full. Changes will last for this visit only.",
        );
      }
    }
  },
  removeItem(key) {
    fallback.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      /* In-memory demo still works. */
    }
  },
};
