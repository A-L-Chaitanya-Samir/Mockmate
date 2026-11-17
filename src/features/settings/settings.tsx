"use client";
import { DEMO_MODE } from "@/lib/mode";
import { LiveSettings } from "@/features/live/dashboard";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Monitor,
  Moon,
  Sun,
  Save,
  LogOut,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useDemoStore } from "@/stores/demo-store";
import { Button } from "@/components/ui/button";
import { Panel, PageHeading, Field, Badge } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import type { Profile } from "@/types";
import { useDemoReady } from "@/hooks/use-demo-ready";
import { Skeleton } from "@/components/ui/primitives";
const profileSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(60),
  role: z.string().trim().min(3, "Use at least 3 characters.").max(100),
  bio: z.string().max(300, "Keep your bio within 300 characters."),
});
function ProfileForm() {
  const profile = useDemoStore((s) => s.profile);
  const save = useDemoStore((s) => s.saveProfile);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<Profile>({
    resolver: zodResolver(profileSchema),
    defaultValues: profile,
  });
  return (
    <Panel>
      <h2 className="mb-2">A little about you</h2>
      <p className="text-subtle text-xs mb-7">
        Use demo details. This profile is stored only in this browser.
      </p>
      <form
        className="space-y-5 max-w-2xl"
        onSubmit={handleSubmit((v) => {
          save(v);
          reset(v);
          toast.success("Demo profile saved.");
        })}
        noValidate
      >
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Display name" error={errors.name?.message}>
            <input {...register("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Target role" error={errors.role?.message}>
            <input {...register("role")} aria-invalid={!!errors.role} />
          </Field>
        </div>
        <Field label="A short bio" error={errors.bio?.message}>
          <textarea rows={4} {...register("bio")} aria-invalid={!!errors.bio} />
        </Field>
        <Button disabled={!isDirty}>
          <Save size={15} />
          Save profile
        </Button>
      </form>
    </Panel>
  );
}
export function Settings() {
  return DEMO_MODE ? <DemoSettings /> : <LiveSettings />;
}
function DemoSettings() {
  const ready = useDemoReady();
  return ready ? <SettingsContent /> : <Skeleton />;
}
function SettingsContent() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { preferences, savePreferences, logout, reset } = useDemoStore();
  const [resetOpen, setResetOpen] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="A WORKSPACE THAT FEELS LIKE YOU"
        title="Make yourself at home."
        description="Your profile, preferences, and demo data — all in one place."
      />
      <Tabs
        tabs={[
          { value: "profile", label: "Profile", content: <ProfileForm /> },
          {
            value: "appearance",
            label: "Appearance",
            content: (
              <Panel>
                <h2 className="mb-2">Set the mood</h2>
                <p className="text-subtle text-xs mb-7">
                  One theme, consistently applied across every page.
                </p>
                <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
                  {[
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "system", label: "System", icon: Monitor },
                  ].map((t) => (
                    <button
                      key={t.value}
                      className="selection-card min-h-32"
                      aria-pressed={theme === t.value}
                      onClick={() => {
                        setTheme(t.value);
                        toast.success(`${t.label} appearance selected.`);
                      }}
                    >
                      <t.icon />
                      {t.label}
                    </button>
                  ))}
                </div>
              </Panel>
            ),
          },
          {
            value: "preferences",
            label: "Preferences",
            content: (
              <div className="space-y-6">
                <Panel>
                  <h2>Stay in the loop</h2>
                  {[
                    {
                      key: "notifications" as const,
                      title: "Product notifications",
                      text: "Save a demo preference for in-app updates.",
                    },
                    {
                      key: "reminders" as const,
                      title: "Practice reminders",
                      text: "Save a preference only. No reminders or emails are scheduled.",
                    },
                  ].map((p) => (
                    <label className="setting-row" key={p.key}>
                      <div>
                        <h3 className="text-sm">{p.title}</h3>
                        <p>{p.text}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences[p.key]}
                        onChange={(e) => {
                          savePreferences({
                            ...preferences,
                            [p.key]: e.target.checked,
                          });
                          toast.success("Preference saved locally.");
                        }}
                      />
                    </label>
                  ))}
                </Panel>
                <Panel>
                  <h2 className="mb-6">Your practice defaults</h2>
                  <div className="grid sm:grid-cols-2 gap-5 max-w-2xl">
                    <Field label="Default interview type">
                      <select
                        value={preferences.defaultType}
                        onChange={(e) => {
                          savePreferences({
                            ...preferences,
                            defaultType: e.target
                              .value as typeof preferences.defaultType,
                          });
                          toast.success("Default interview type saved.");
                        }}
                      >
                        {["Technical", "HR", "Behavioral", "Mixed"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Default practice mode">
                      <select
                        value={preferences.defaultMode}
                        onChange={(e) => {
                          savePreferences({
                            ...preferences,
                            defaultMode: e.target
                              .value as typeof preferences.defaultMode,
                          });
                          toast.success("Default practice mode saved.");
                        }}
                      >
                        {["Text", "Voice", "Video"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </Panel>
              </div>
            ),
          },
          {
            value: "account",
            label: "Demo account",
            content: (
              <>
                <Panel>
                  <div className="panel-heading">
                    <h2>Your demo workspace</h2>
                    <Badge tone="muted">LOCAL ONLY</Badge>
                  </div>
                  <div className="flex gap-3 p-4 bg-elevated rounded-lg mb-7">
                    <ShieldCheck className="text-primary shrink-0" size={20} />
                    <p className="text-muted text-xs leading-6">
                      This is not a production account. There is no stored
                      password or backend. Demo preferences, file metadata, and
                      typed interview answers are stored in this browser. Clear
                      them below whenever you want.
                    </p>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3 className="text-sm">Log out</h3>
                      <p>
                        End your local demo login. Practice history is
                        preserved.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        logout();
                        router.push("/login");
                      }}
                    >
                      <LogOut size={15} />
                      Log out
                    </Button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3 className="text-sm">Reset demo data</h3>
                      <p>
                        Remove your practice sessions and restore sample data.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setResetOpen(true)}
                    >
                      <RotateCcw size={15} />
                      Reset demo
                    </Button>
                  </div>
                </Panel>
              </>
            ),
          },
        ]}
      />
      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="A fresh start?"
        description="This removes locally saved interviews, resume metadata, and profile changes. The sample sessions will be restored. This cannot be undone."
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            Keep my progress
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              reset();
              setResetOpen(false);
              toast.success("Demo data reset.");
              router.push("/dashboard");
            }}
          >
            Reset demo data
          </Button>
        </div>
      </Dialog>
    </>
  );
}
