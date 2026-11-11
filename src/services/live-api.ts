/* eslint-disable @next/next/no-location-assign-relative-destination -- Full navigation intentionally clears account memory. */
import { browserAuth } from "@/lib/supabase/browser";
import type { components } from "@/lib/api/generated";
export type DTO<K extends keyof components["schemas"]> =
  components["schemas"][K];

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const {
    data: { session },
    error,
  } = await browserAuth().auth.getSession();
  if (error || !session) {
    location.assign("/login?error=session_expired");
    throw new Error("Session expired. Sign in again.");
  }
  const timeout = AbortSignal.timeout(30000);
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1${path}`,
    {
      ...options,
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
      cache: "no-store",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${session.access_token}`,
        ...options.headers,
      },
    },
  );
  if (response.status === 401) {
    await browserAuth().auth.signOut({ scope: "local" });
    location.assign("/login?error=session_expired");
  }
  if (
    options.method &&
    options.method !== "GET" &&
    (/^\/resumes/.test(path) ||
      path === "/interviews" ||
      path.endsWith("/retry"))
  ) {
    window.dispatchEvent(new Event("mockmate:usage-changed"));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      `${body?.error?.message || "Request failed. Please retry."}${body?.error?.quota?.reset_at ? ` Both allowances renew ${new Date(body.error.quota.reset_at).toLocaleString()} (your local time).` : ""}${body?.error?.request_id ? ` (Request ${body.error.request_id})` : ""}`,
    );
  }
  return response.json() as Promise<T>;
}

export async function signOut() {
  const { error } = await browserAuth().auth.signOut();
  if (error) throw error;
  // Full navigation drops every in-memory account record and draft.
  location.replace("/login");
}

export function exportJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
