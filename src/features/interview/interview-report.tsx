"use client";
import Link from "next/link";
import { ArrowRight, Download, CheckCircle2 } from "lucide-react";
import { useDemoStore } from "@/stores/demo-store";
import { useDemoReady } from "@/hooks/use-demo-ready";
import { mockReport, questionsFor } from "@/data/mock-data";
import {
  Panel,
  PageHeading,
  Badge,
  ScoreRing,
  Progress,
  CheckList,
  DemoNotice,
  EmptyState,
  Skeleton,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { CompetencyChart } from "@/components/charts";
import { DEMO_MODE } from "@/lib/mode";
import { LiveReport } from "@/features/live/interviews";
export function InterviewReport({ interviewId }: { interviewId: string }) {
  return DEMO_MODE ? (
    <DemoInterviewReport interviewId={interviewId} />
  ) : (
    <LiveReport interviewId={interviewId} />
  );
}
function DemoInterviewReport({ interviewId }: { interviewId: string }) {
  const ready = useDemoReady();
  const session = useDemoStore((s) =>
    s.sessions.find((x) => x.id === interviewId),
  );
  const summary = useDemoStore((s) =>
    s.history.find((x) => x.id === interviewId),
  );
  if (!ready) return <Skeleton />;
  if (!summary || (session && session.status !== "completed"))
    return (
      <EmptyState
        title="No completed report for this session."
        description="Complete a demo interview or explore a sample report from your history."
        action={
          <Button asChild>
            <Link href="/dashboard/interview">View interviews</Link>
          </Button>
        }
      />
    );
  const questions = questionsFor(session?.config.type ?? summary.type);
  const report = mockReport;
  function download() {
    const data = {
      notice: "SIMULATED REPORT — fixed fixture scores, not real evaluation",
      role: summary!.role,
      report,
      answers: session?.answers ?? [],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mockmate-demo-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeading
        eyebrow="A MOMENT TO REFLECT"
        title="You showed up. That’s progress."
        description={`${summary.role} · ${summary.type} interview · Sample evaluation report`}
        action={
          <Button asChild>
            <Link href="/dashboard/interview/setup">
              Practice again
              <ArrowRight size={15} />
            </Link>
          </Button>
        }
      />
      <DemoNotice />
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 my-6">
        <Panel>
          <Badge tone="green">
            <CheckCircle2 size={11} />
            PRACTICE COMPLETE
          </Badge>
          <div className="flex flex-wrap items-center gap-6 my-6">
            <ScoreRing
              score={
                summary.id.startsWith("sample") ? summary.score : report.overall
              }
              label="Sample overall score"
              size={155}
            />
            <div>
              <h2>A strong foundation.</h2>
              <p className="text-muted text-xs mt-2 max-w-44">
                Keep practicing, stay curious, and make the next answer a little
                clearer.
              </p>
            </div>
          </div>
          <p className="text-subtle text-[10px]">
            All category feedback below is the same predefined example for every
            session.
          </p>
          <div className="flex gap-2 mt-6">
            <Button variant="secondary" size="sm" onClick={download}>
              <Download size={14} />
              Export demo report
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </Panel>

        <Panel>
          <div className="grid sm:grid-cols-2 gap-8 items-center">
            <div className="space-y-5">
              {report.scores.map((s) => (
                <Progress key={s.skill} label={s.skill} value={s.score} />
              ))}
            </div>
            <CompetencyChart />
          </div>
        </Panel>
      </div>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Panel>
          <h2 className="mb-5">Strengths to build on</h2>
          <CheckList items={report.strengths} />
        </Panel>
        <Panel>
          <h2 className="mb-5">Try this next time</h2>
          <CheckList items={report.improvements} warning />
        </Panel>
      </div>
      <Panel className="mb-6">
        <div className="panel-heading">
          <h2>One question at a time</h2>
          <Badge tone="muted">PREWRITTEN FEEDBACK</Badge>
        </div>
        <div className="space-y-5">
          {questions.map((q, i) => {
            const answer = session?.answers.find(
              (a) => a.questionId === q.id,
            )?.text;
            return (
              <div key={q.id} className="p-5 border border-border rounded-lg">
                <span className="eyebrow text-[9px]">
                  QUESTION {i + 1} · {q.topic}
                </span>
                <h3 className="mt-2 mb-3">{q.prompt}</h3>
                <p className="text-muted text-xs leading-6 whitespace-pre-wrap break-words">
                  {session
                    ? answer || "No answer submitted."
                    : "Sample session — no typed answer is stored."}
                </p>
                <div className="border-t border-border mt-4 pt-4">
                  <p className="text-primary text-[10px] mb-1">
                    PRACTICE GUIDANCE · NOT AI EVALUATION
                  </p>
                  <p className="text-muted text-xs">{q.guidance}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel>
        <h2 className="mb-5">Recommended areas to practise</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {report.topics.map((t, i) => (
            <Link
              href="/dashboard/suggestions"
              className="p-5 bg-elevated border border-border rounded-lg hover:border-primary transition-colors"
              key={t}
            >
              <span className="text-primary text-[10px]">0{i + 1}</span>
              <h3 className="text-sm my-3">{t}</h3>
              <span className="flex gap-2 items-center text-primary text-xs">
                View suggestions
                <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
