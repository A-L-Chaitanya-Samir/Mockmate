"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/mock-services";
import { errorMessage } from "@/services/api-client";
import { useDemoStore } from "@/stores/demo-store";
import { Button } from "@/components/ui/button";
import { Badge, Field, Spinner } from "@/components/ui/primitives";
import { DEMO_MODE } from "@/lib/mode";
import { LiveAuthForm } from "./live-auth-form";
const authSchema = z.object({
  name: z.string().optional(),
  email: z.email("Enter a valid email address."),
  password: z.string().optional(),
  terms: z.boolean().optional(),
});
type Values = z.infer<typeof authSchema>;
export function AuthForm({ mode }: { mode: "login" | "register" | "forgot" }) {
  return DEMO_MODE ? <DemoAuthForm mode={mode} /> : <LiveAuthForm mode={mode} />;
}
function DemoAuthForm({ mode }: { mode: "login" | "register" | "forgot" }) {
  const router = useRouter();
  const login = useDemoStore((s) => s.login);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const schema = authSchema.superRefine((v, ctx) => {
    if (mode !== "forgot" && (v.password?.length ?? 0) < 8)
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message:
          "Use at least 8 characters. Choose a demo password, not a real one.",
      });
    if (mode === "register" && (v.name?.trim().length ?? 0) < 2)
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Enter at least 2 characters.",
      });
    if (mode === "register" && !v.terms)
      ctx.addIssue({
        code: "custom",
        path: ["terms"],
        message: "Please acknowledge the demo notice.",
      });
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    resetField,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { terms: false },
  });
  async function submit(values: Values) {
    try {
      if (mode === "forgot") {
        await authService.resetPassword();
        setDone(true);
        return;
      }
      const profile = await authService.signIn();
      login({
        ...profile,
        name: mode === "register" ? values.name!.trim() : profile.name,
      });
      resetField("password");
      router.push("/dashboard");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function demoLogin() {
    setBusy(true);
    try {
      login(await authService.signIn());
      router.push("/dashboard");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <Badge>
          <Sparkles size={11} />
          YOUR NEXT CHAPTER
        </Badge>
        <h2>
          A little preparation.
          <br />A world of possibility.
        </h2>
        <p>
          Your skills are growing. Your story is taking shape.
          <br />
          Let’s make sure your next interview shows it.
        </p>
        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs">
            Practice at your pace. Reflect with purpose.
            <br />
            Show up as your best prepared self.
          </p>
          <span className="eyebrow block mt-5">THE MOCKMATE WAY</span>
        </div>
      </div>
      <div className="auth-form">
        {done ? (
          <div className="space-y-5">
            <CheckCircle2 className="text-success" size={36} />
            <h1>Demo request complete.</h1>
            <p className="text-muted">
              No email was sent. Password recovery will be connected to real
              authentication in Phase 2.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1>
              {mode === "login"
                ? "Welcome back."
                : mode === "register"
                  ? "Your next step starts here."
                  : "Let’s get you back in."}
            </h1>
            <p>
              {mode === "login"
                ? "Sign in to your Mockmate demo workspace."
                : mode === "register"
                  ? "Create a local demo profile and start preparing."
                  : "Explore the password recovery flow."}
            </p>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(submit)}
              noValidate
            >
              {mode === "register" && (
                <Field label="Full name" error={errors.name?.message}>
                  <input
                    autoComplete="name"
                    placeholder="Your name"
                    {...register("name")}
                    aria-invalid={!!errors.name}
                    maxLength={60}
                  />
                </Field>
              )}
              <Field label="Email address" error={errors.email?.message}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
              </Field>
              {mode !== "forgot" && (
                <Field
                  label="Demo password"
                  error={errors.password?.message}
                  hint="Use an invented password. It is never stored."
                >
                  <div className="password-wrap">
                    <input
                      aria-label="Demo password"
                      type={visible ? "text" : "password"}
                      autoComplete="off"
                      placeholder="At least 8 characters"
                      {...register("password")}
                      aria-invalid={!!errors.password}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={visible ? "Hide password" : "Show password"}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </Field>
              )}
              {mode === "login" && (
                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-primary text-xs"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
              {mode === "register" && (
                <div>
                  <label className="flex items-start gap-3 text-muted text-[11px]">
                    <input type="checkbox" {...register("terms")} />I understand
                    this is a local portfolio demo, with simulated services and
                    no real account creation.
                  </label>
                  {errors.terms && (
                    <p className="text-error text-xs mt-2" role="alert">
                      {errors.terms.message}
                    </p>
                  )}
                </div>
              )}
              <Button className="w-full" disabled={isSubmitting || busy}>
                {isSubmitting ? (
                  <Spinner label="Please wait…" />
                ) : (
                  <>
                    {mode === "login"
                      ? "Sign in"
                      : mode === "register"
                        ? "Create demo profile"
                        : "Send demo reset request"}
                    <ArrowRight size={15} />
                  </>
                )}
              </Button>
            </form>
            {mode !== "forgot" && (
              <>
                <div className="form-divider">OR EXPLORE FIRST</div>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={busy || isSubmitting}
                  onClick={demoLogin}
                >
                  {busy ? (
                    <Spinner label="Opening workspace…" />
                  ) : (
                    <>
                      <Sparkles size={15} />
                      Continue with demo account
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted mt-6">
                  {mode === "login"
                    ? "New to Mockmate? "
                    : "Already exploring? "}
                  <Link
                    className="text-primary"
                    href={mode === "login" ? "/register" : "/login"}
                  >
                    {mode === "login" ? "Create a demo profile" : "Sign in"}
                  </Link>
                </p>
              </>
            )}
          </>
        )}
        <p className="text-subtle text-[10px] text-center mt-7">
          Frontend demo · No production authentication
          <br />
          Email and password are not persisted.
        </p>
      </div>
    </div>
  );
}
