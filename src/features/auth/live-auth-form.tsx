"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Authentication changes require a fresh account render. */
import Link from "next/link";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { browserAuth } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Badge, Field, Spinner } from "@/components/ui/primitives";
const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};

export function LiveAuthForm({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset";
}) {
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const query = useSyncExternalStore(
    subscribe,
    () => location.search,
    () => "",
  );
  const code = new URLSearchParams(query).get("error");
  const linkError =
    code === "setup_required"
      ? "Supabase is not configured. Follow docs/phase-2-setup.md."
      : code === "session_expired"
        ? "Your session expired. Sign in again."
        : code === "invalid_link"
          ? "This link is invalid or expired. Request a new email."
          : "";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cooldown && (mode === "register" || mode === "forgot")) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      const client = browserAuth();
      const callback = `${location.origin}/auth/callback`;
      if (mode === "register") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callback,
            data: { name: String(form.get("name")) },
          },
        });
        if (error) throw error;
        setMessage(
          "Check your email to verify your account, then sign in. Delivery depends on the configured email service.",
        );
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${callback}?next=/reset-password`,
        });
        if (error) throw error;
        setMessage(
          "If an eligible account exists, a recovery email will be sent. Check your inbox.",
        );
      } else if (mode === "reset") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        await client.auth.signOut();
        location.assign("/login?message=password_updated");
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        location.assign("/dashboard");
      }
    } catch (e) {
      setError(authError(e));
    } finally {
      if (mode === "register" || mode === "forgot") setCooldown(60);
      setBusy(false);
    }
  }
  async function resend(form: HTMLFormElement) {
    if (
      mode !== "register" ||
      busy ||
      cooldown ||
      !form.elements.namedItem("email")
    )
      return;
    const input = form.elements.namedItem("email") as HTMLInputElement;
    if (!input.reportValidity()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await browserAuth().auth.resend({
        type: "signup",
        email: input.value,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMessage(
        "If this account needs verification, a new link will be sent. Check your inbox and spam folder.",
      );
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
      setCooldown(60);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <Badge>YOUR NEXT CHAPTER</Badge>
        <h2>
          A little preparation.
          <br />A world of possibility.
        </h2>
        <p>Prepare with purpose. Keep your progress in your account.</p>
      </div>
      <div className="auth-form">
        <h1>
          {mode === "login"
            ? "Welcome back."
            : mode === "register"
              ? "Your next step starts here."
              : mode === "reset"
                ? "Choose a new password."
                : "Let’s get you back in."}
        </h1>
        <p>Secure account access with Supabase.</p>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <Field label="Full name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={60}
                autoComplete="name"
              />
            </Field>
          )}
          {mode !== "reset" && (
            <Field label="Email address">
              <input name="email" type="email" required autoComplete="email" />
            </Field>
          )}
          {mode !== "forgot" && (
            <Field label="Password">
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </Field>
          )}
          {mode === "register" && (
            <label className="flex gap-3 text-xs">
              <input type="checkbox" required />I understand resume excerpts and
              interview text are processed by an external AI provider.
            </label>
          )}
          {(error || linkError) && (
            <p role="alert" className="text-error">
              {error || linkError}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <Button
            disabled={
              busy ||
              (cooldown > 0 && (mode === "register" || mode === "forgot"))
            }
            className="w-full"
          >
            {busy ? (
              <Spinner label="Please wait…" />
            ) : mode === "login" ? (
              "Sign in"
            ) : mode === "register" ? (
              "Create account"
            ) : mode === "reset" ? (
              "Update password"
            ) : (
              "Send recovery email"
            )}
          </Button>
          {mode === "register" && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || cooldown > 0}
              onClick={(event) => {
                if (event.currentTarget.form)
                  void resend(event.currentTarget.form);
              }}
            >
              Resend verification email
            </Button>
          )}
          {cooldown > 0 && (
            <p aria-live="polite">
              Email actions available again in {cooldown} seconds. Check your
              inbox before retrying.
            </p>
          )}
        </form>
        <div className="flex flex-wrap gap-4 mt-6 text-primary text-xs">
          <Link href="/login">Sign in</Link>
          <Link href="/register">Create account</Link>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <p className="text-xs text-muted mt-6">
          {mode === "register"
            ? "Expired verification link? Request another verification email here."
            : "Need a new recovery link? Use Forgot password to request one."}
        </p>
      </div>
    </div>
  );
}

function authError(error: unknown): string {
  const value = error as { code?: string; status?: number };
  if (
    value?.status === 429 ||
    ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
      value?.code || "",
    )
  )
    return "Email requests are temporarily limited. Wait a few minutes before trying again.";
  if (
    [
      "email_address_not_authorized",
      "unexpected_failure",
      "email_send_failed",
    ].includes(value?.code || "") ||
    (value?.status || 0) >= 500
  )
    return "Email delivery is temporarily unavailable. Please try later or contact support.";
  if (value?.code === "email_not_confirmed")
    return "Verify your email before signing in.";
  if (value?.code === "otp_expired")
    return "This link has expired. Request a new verification or recovery email.";
  if (value?.code === "user_already_exists")
    return "Check your inbox or sign in. If needed, request password recovery.";
  return "Unable to complete authentication. Check your details and try again.";
}
