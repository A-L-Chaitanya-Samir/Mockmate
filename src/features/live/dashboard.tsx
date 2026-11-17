"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FileText, MessagesSquare, TrendingUp, Sparkles } from "lucide-react";
import {
  Panel,
  PageHeading,
  Metric,
  Field,
  CheckList,
  EmptyState,
  Badge,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  PerformanceChart,
  CompetencyChart,
  SkillChart,
} from "@/components/charts";
import { ThemeToggle } from "@/components/theme-toggle";
import { api, signOut, type DTO } from "@/services/live-api";
import { useWorkspace, JobErrors } from "./workspace";
import { LiveHistory } from "./interviews";

export function LiveDashboard({
  analytics = false,
  suggestions = false,
}: {
  analytics?: boolean;
  suggestions?: boolean;
}) {
  const { data } = useWorkspace();
  const [range, setRange] = useState("all");
  const completed = data!.interviews
    .filter((s) => s.report)
    .slice()
    .reverse();
  const shown = range === "recent" ? completed.slice(-3) : completed;
  const average = shown.length
    ? Math.round(
        shown.reduce((n, s) => n + s.report!.overall, 0) / shown.length,
      )
    : "—";
  const resume = data!.resumes.find((r) => r.analysis);
  const latest = completed.at(-1);
  const advice = [
    ...(resume?.analysis?.improvements.map((text) => ({
      text,
      source: resume.filename,
      url: "/dashboard/resume/improve",
    })) || []),
    ...(latest?.report?.recommendations.map((text) => ({
      text,
      source: `${latest.config.role} · ${new Date(latest.created_at).toLocaleDateString()}`,
      url: `/dashboard/interview/${latest.id}/report`,
    })) || []),
  ];
  const dimensions = shown.length ? shown.at(-1)!.report!.scores : [];
  return (
    <>
      <PageHeading
        eyebrow={
          suggestions ? "KNOW WHAT TO IMPROVE NEXT" : "YOUR CAREER, IN PROGRESS"
        }
        title={
          suggestions
            ? "Suggestions & Advice"
            : analytics
              ? "Small steps. Measurable growth."
              : `Welcome back, ${data!.profile.name.split(" ")[0]}.`
        }
        description={
          suggestions
            ? "Actionable suggestions from your saved resume and interview results."
            : "Your own progress, saved across devices."
        }
        action={
          <Button asChild>
            <Link href="/dashboard/interview/setup">Start an interview</Link>
          </Button>
        }
      />
      {!suggestions && (
        <>
          {!analytics && (
            <div className="dashboard-banner">
              <div>
                <Badge>
                  <Sparkles size={12} />
                  YOUR NEXT BIG MOVE
                </Badge>
                <h2>
                  Great interviews start
                  <br />
                  before the interview.
                </h2>
                <p>
                  Build your skills, sharpen your story, and prepare with
                  purpose.
                </p>
                <Button asChild className="mt-5">
                  <Link href="/dashboard/resume/analyze">
                    Analyze your resume
                  </Link>
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 my-6">
            <Metric
              label="Resume quality"
              value={resume?.analysis?.score ?? "—"}
              note="Document rubric"
              icon={<FileText />}
            />
            <Metric
              label="Interview sessions"
              value={data!.interviews.length}
              note={`${completed.length} evaluated`}
              icon={<MessagesSquare />}
            />
            <Metric
              label="Average interview score"
              value={average}
              note="Saved text results"
              icon={<TrendingUp />}
            />
            <Metric
              label="Interviews remaining"
              value={data!.capabilities.interviews_remaining}
              note={"24-hour allowance"}
              icon={<Sparkles />}
            />
          </div>
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
            <Panel>
              <div className="panel-heading">
                <h2>Interview performance</h2>
                <select
                  aria-label="Analytics period"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option value="all">All sessions</option>
                  <option value="recent">Last 3 sessions</option>
                </select>
              </div>
              {shown.length >= 2 ? (
                <PerformanceChart
                  data={shown.map((s) => ({
                    label: new Date(s.created_at).toLocaleDateString(),
                    score: s.report!.overall,
                  }))}
                />
              ) : (
                <EmptyState
                  title="More practice, more perspective."
                  description="Complete at least two interviews to see your progress over time."
                />
              )}
            </Panel>
            <Panel>
              <h2 className="mb-4">Latest text dimensions</h2>
              {dimensions.length ? (
                <CompetencyChart scores={dimensions} />
              ) : (
                <p className="text-muted">
                  Complete a session to see your own results.
                </p>
              )}
            </Panel>
          </div>
          {analytics && dimensions.length > 0 && (
            <Panel className="mt-6">
              <SkillChart scores={dimensions} />
            </Panel>
          )}
          <Panel className="my-6">
            <div className="panel-heading">
              <h2>Recent activity</h2>
              <Link href="/dashboard/interview" className="text-primary">
                All interviews
              </Link>
            </div>
            <LiveHistory
              interviews={data!.interviews.slice(0, analytics ? undefined : 5)}
            />
          </Panel>
        </>
      )}
      <Panel className="mt-6">
        <h2 className="mb-5">Your next steps</h2>
        {advice.length ? (
          <div className="grid md:grid-cols-2 gap-5">
            {advice.map((a, i) => (
              <div key={i} className="p-4 bg-elevated rounded-lg">
                <p>{a.text}</p>
                <p className="text-xs text-subtle my-3">Source: {a.source}</p>
                <Link href={a.url} className="text-primary text-xs">
                  View saved feedback →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Start with your experience."
            description="Analyze a resume or complete an interview to receive input-derived suggestions."
          />
        )}
      </Panel>
      <JobErrors />
    </>
  );
}

export function LiveSettings() {
  const { data, reload } = useWorkspace();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError("");
    const fields = new FormData(event.currentTarget);
    const profile: DTO<"ProfileInput"> = {
      name: String(fields.get("name")),
      role: String(fields.get("role")),
      bio: String(fields.get("bio")),
      notifications: fields.has("notifications"),
      reminders: fields.has("reminders"),
      default_type: String(
        fields.get("default_type"),
      ) as DTO<"ProfileInput">["default_type"],
      default_mode: "Spoken",
    };
    try {
      await api("/profile", { method: "PUT", body: JSON.stringify(profile) });
      await reload();
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Make yourself at home."
        description="Your profile and preferences are saved to your account."
      />
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <Panel>
          <h2 className="mb-5">A little about you</h2>
          <form onSubmit={submit} className="space-y-5">
            <Field label="Display name">
              <input
                name="name"
                defaultValue={data!.profile.name}
                required
                minLength={2}
                maxLength={60}
              />
            </Field>
            <Field label="Target role">
              <input
                name="role"
                defaultValue={data!.profile.role}
                maxLength={120}
              />
            </Field>
            <Field label="Bio">
              <textarea
                name="bio"
                defaultValue={data!.profile.bio}
                maxLength={1000}
                rows={4}
              />
            </Field>
            <label className="flex gap-3">
              <input
                name="notifications"
                type="checkbox"
                defaultChecked={data!.profile.notifications}
              />
              Product notifications preference
            </label>
            <label className="flex gap-3">
              <input
                name="reminders"
                type="checkbox"
                defaultChecked={data!.profile.reminders}
              />
              Practice reminders preference
            </label>
            <Field label="Default interview type">
              <select
                name="default_type"
                defaultValue={data!.profile.default_type}
              >
                {["Technical", "HR", "Behavioral", "Mixed"].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="Default interview mode">
              <select disabled defaultValue="Spoken">
                <option>Spoken</option>
              </select>
            </Field>
            <p className="text-xs text-muted">
              Preferences are saved; automatic notification delivery is a future
              feature.
            </p>
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            {saved && <p role="status">Profile saved.</p>}
            <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </form>
        </Panel>
        <div className="space-y-6">
          <Panel>
            <h2 className="mb-4">Appearance</h2>
            <ThemeToggle />
          </Panel>
          <Panel>
            <h2 className="mb-4">Usage limits</h2>
            <CheckList
              items={[
                `${data!.capabilities.resumes_remaining} resume analyses remaining`,
                `${data!.capabilities.interviews_remaining} interviews remaining`,
                "Both allowances renew together 24 hours after the first accepted use.",
              ]}
            />
          </Panel>
          <Panel>
            <h2 className="mb-4">Account</h2>
            <Button
              variant="secondary"
              onClick={() => void signOut().catch((e) => setError(String(e)))}
            >
              Log out
            </Button>
            <p className="text-xs text-muted mt-4">
              Logging out removes account data and unsent drafts from this
              browser’s memory.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
