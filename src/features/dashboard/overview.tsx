"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  MessagesSquare,
  TrendingUp,
  Sparkles,
  Lightbulb,
  Code2,
} from "lucide-react";
import { useDemoStore } from "@/stores/demo-store";
import { Panel, Badge, PageHeading, Metric } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PerformanceChart } from "@/components/charts";
import { InterviewHistory } from "./interview-history";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { UpgradePrompt } from "@/components/plan-access";
import { buildSuggestions } from "@/features/suggestions/suggestions-data";
import { DEMO_MODE } from "@/lib/mode";
import { LiveDashboard } from "@/features/live/dashboard";
export function Overview() {
  return DEMO_MODE ? <DemoOverview /> : <LiveDashboard />;
}
function DemoOverview() {
  const { profile, history, resumes, codingRounds } = useDemoStore();
  const { can, definition, interviews } = useFeatureAccess();
  const advice = buildSuggestions(
    resumes,
    history,
    codingRounds,
    can("codingRounds"),
  );
  const average = Math.round(
    history.reduce((total, h) => total + h.score, 0) /
      Math.max(1, history.length),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR CAREER, IN PROGRESS"
        title={`Welcome back, ${profile.name.split(" ")[0]}.`}
        description="Every practice session is a step closer to your next opportunity."
        action={
          <Button asChild>
            <Link href="/dashboard/interview/setup">
              <MessagesSquare size={16} />
              Start an interview
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        }
      />
      <div className="dashboard-banner">
        <div>
          <Badge>
            <Sparkles size={11} />
            YOUR NEXT BIG MOVE
          </Badge>
          <h2>
            Great interviews start
            <br />
            before the interview.
          </h2>
          <p>
            Build your skills, sharpen your story, and walk into your next
            conversation with confidence.
          </p>
          <Button asChild className="mt-5" size="sm">
            <Link href="/dashboard/interview/setup">
              Let’s get you ready <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
        <div className="banner-art">
          <MessagesSquare />
          <Badge tone="green">Practice. Reflect. Grow.</Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Metric
          label="Total interviews"
          value={String(history.length).padStart(2, "0")}
          note="Your practice journey"
          icon={<MessagesSquare />}
        />
        <Metric
          label="Average score"
          value={
            <>
              {average}
              <small> / 100</small>
            </>
          }
          note="Across demo sessions"
          icon={<TrendingUp />}
        />
        <Metric
          label="Resume score"
          value={
            <>
              {resumes[0]?.analysis.score ?? 81}
              <small> / 100</small>
            </>
          }
          note={
            resumes.length ? "Latest demo analysis" : "Sample resume analysis"
          }
          icon={<FileText />}
        />
        <Metric
          label="Coding rounds"
          value={can("codingRounds") ? "Unlocked" : "Pro exclusive"}
          note={
            can("codingRounds")
              ? `${codingRounds.length} demo rounds created`
              : "Upgrade for technical coding interviews"
          }
          icon={<Code2 />}
        />
      </div>
      <div className="grid xl:grid-cols-[1.7fr_1fr] gap-6 mb-6">
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>Your progress, visualized</h2>
              <p className="text-subtle text-[11px] mt-1">
                Interview performance over recent sessions
              </p>
            </div>
            <Badge tone="muted">Demo data</Badge>
          </div>
          <PerformanceChart
            data={[...history]
              .reverse()
              .slice(-8)
              .map((h, i) => ({ label: `Session ${i + 1}`, score: h.score }))}
          />
        </Panel>
        {can("codingRounds") ? (
          <Panel>
            <Badge tone="green">PRO CODING ROUNDS</Badge>
            <Code2 size={29} className="text-primary my-6" />
            <h2>Your next technical round awaits.</h2>
            <p className="text-muted text-xs my-4">
              A timed problem, your choice of language, and scripted interviewer
              follow-ups.
            </p>
            <Button asChild>
              <Link href="/dashboard/coding">
                {codingRounds[0]?.status === "active"
                  ? "Resume coding round"
                  : "Start a coding round"}
                <ArrowRight size={14} />
              </Link>
            </Button>
          </Panel>
        ) : (
          <UpgradePrompt compact title="Go beyond the conversation." />
        )}
      </div>
      <div className="grid xl:grid-cols-[1.7fr_1fr] gap-6">
        <Panel>
          <div className="panel-heading">
            <h2>Recent activity · Interviews</h2>
            <Link
              href="/dashboard/interview"
              className="text-primary text-[11px] flex items-center gap-1"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <InterviewHistory limit={3} />
        </Panel>
        <Panel>
          <div className="panel-heading">
            <h2>Four ways to prepare</h2>
            <Sparkles size={16} className="text-primary" />
          </div>
          {[
            {
              title: "Give your resume an edge",
              text: "Find opportunities in your resume",
              href: "/dashboard/resume",
              icon: FileText,
            },
            {
              title: "Practise an AI interview",
              text: `${interviews.remaining} demo sessions remaining`,
              href: "/dashboard/interview/setup",
              icon: MessagesSquare,
            },
            {
              title: "Practice your problem solving",
              text: can("codingRounds")
                ? "Start a technical coding round"
                : "Coding rounds · Pro exclusive",
              href: "/dashboard/coding",
              icon: Code2,
            },
            {
              title: "Choose your next improvement",
              text: "Explore Suggestions & Advice",
              href: "/dashboard/suggestions",
              icon: Lightbulb,
            },
          ].map((a, i) => (
            <div className="action-row" key={a.href}>
              <a.icon />
              <div>
                <span className="step">0{i + 1}</span>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </div>
              <Button asChild variant="ghost" size="icon">
                <Link href={a.href} aria-label={a.title}>
                  <ArrowUpRight size={17} />
                </Link>
              </Button>
            </div>
          ))}
        </Panel>
      </div>
      <Panel className="mt-6">
        <div className="panel-heading">
          <h2>Improvement suggestions</h2>
          <Badge tone="muted">{definition.name} · MOCK INSIGHTS</Badge>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {advice.slice(0, 2).map((item) => (
            <div key={item.id}>
              <h3 className="text-sm mb-2">{item.title}</h3>
              <p className="text-muted text-xs leading-6">{item.detail}</p>
              <Link
                href="/dashboard/suggestions"
                className="inline-flex gap-2 items-center text-primary text-xs mt-4"
              >
                Review next steps
                <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
