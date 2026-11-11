"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Panel,
  PageHeading,
  Field,
  Badge,
  Spinner,
  ScoreRing,
  CheckList,
  EmptyState,
  Progress,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { CompetencyChart } from "@/components/charts";
import { api, exportJson, type DTO } from "@/services/live-api";
import { JobErrors, useWorkspace } from "./workspace";
import { SpokenRoom } from "@/features/interview/spoken/spoken-room";
import { IntegrityReport } from "@/features/interview/spoken/integrity-report";
export function LiveInterviewSetup({ initialType }: { initialType?: string }) {
  const { data } = useWorkspace();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const configuration = {
      ...fields,
      duration: Number(fields.duration),
      mode: "Spoken",
      resume_id: fields.resume_id || null,
    };
    try {
      const result = await api<DTO<"InterviewView">>("/interviews", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify(configuration),
      });
      router.push(`/interview-room/${result.id}`);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR SPACE TO PRACTICE"
        title="Your next practice session"
        description="Four generated questions and up to two contextual follow-ups. Your deadline starts after device checks and question preparation."
      />
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <Panel>
          <form
            className="space-y-5"
            onSubmit={start}
            onChange={() => {
              key.current = crypto.randomUUID();
            }}
          >
            <Field label="Target role">
              <input
                name="role"
                required
                minLength={2}
                maxLength={120}
                defaultValue={data!.profile.role || "Frontend Developer"}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Interview type">
                <select
                  name="type"
                  defaultValue={
                    initialType &&
                    ["Technical", "HR", "Behavioral", "Mixed"].includes(
                      initialType,
                    )
                      ? initialType
                      : data!.profile.default_type
                  }
                >
                  {["Technical", "HR", "Behavioral", "Mixed"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Difficulty">
                <select name="difficulty" defaultValue="Medium">
                  {["Easy", "Medium", "Hard"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Duration">
                <select name="duration" defaultValue="20">
                  {[10, 15, 20, 30, 45, 60].map((t) => (
                    <option key={t} value={t}>
                      {t} minutes
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Technical language">
                <select name="language">
                  {["JavaScript", "Python", "Java", "C++"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Resume context (optional)">
              <select name="resume_id">
                <option value="">Without resume</option>
                {data!.resumes
                  .filter((r) => r.status === "ready")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.filename}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Interview mode">
              <input readOnly value="Video" />
            </Field>
            <label className="flex gap-3 text-xs">
              <input type="checkbox" required />I understand my answer audio and
              confirmed transcripts are processed by Groq.
            </label>
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <Button
              disabled={busy || data!.capabilities.interviews_remaining === 0}
            >
              {busy ? (
                <Spinner label="Starting session…" />
              ) : (
                "Continue to device checks"
              )}
            </Button>
          </form>
        </Panel>
        <Panel>
          <Badge>SPOKEN PRACTICE</Badge>
          <h2 className="my-5">Camera on. Speak it through.</h2>
          <CheckList
            items={[
              "Questions reflect your role, type, difficulty and selected resume.",
              "Answers are saved when you submit each turn.",
              "Up to six questions, with turn-based spoken answers.",
              "End explicitly or complete at the deadline; results use your actual answers.",
            ]}
          />
          <p className="text-muted mt-6">
            Check your camera, microphone and local face detector before
            starting. No full video recording is saved.
          </p>
          <p className="text-xs mt-6">
            {data!.capabilities.interviews_remaining} video interviews
            remaining in this 24-hour window. Saved sessions stay accessible.
          </p>
        </Panel>
      </div>
    </>
  );
}

export function LiveInterviewList() {
  const { data } = useWorkspace();
  return (
    <>
      <PageHeading
        eyebrow="YOUR SPACE TO PRACTICE"
        title="Confidence comes from showing up."
        description="Continue a saved session or reflect on your results."
        action={
          <Button asChild>
            <Link href="/dashboard/interview/setup">New interview</Link>
          </Button>
        }
      />
      <Panel>
        <LiveHistory interviews={data!.interviews} />
      </Panel>
      <JobErrors />
    </>
  );
}

export function LiveHistory({
  interviews,
}: {
  interviews: DTO<"InterviewView">[];
}) {
  return interviews.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ROLE</th>
            <th>TYPE</th>
            <th>DATE</th>
            <th>STATUS / SCORE</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {interviews.map((s) => (
            <tr key={s.id}>
              <td>{s.config.role}</td>
              <td>
                {s.config.type} ·{" "}
                {s.config.mode === "Spoken" ? "Spoken" : "Legacy text"}
              </td>
              <td>{new Date(s.created_at).toLocaleDateString()}</td>
              <td>{s.report ? `${s.report.overall}/100` : s.status}</td>
              <td>
                <Link
                  className="text-primary"
                  href={
                    s.status === "completed" || s.status === "evaluating"
                      ? `/dashboard/interview/${s.id}/report`
                      : `/interview-room/${s.id}`
                  }
                >
                  {s.status === "completed" ? "View report" : "Continue"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="Your first session is ahead."
      description="Start a spoken interview to build your saved practice history."
    />
  );
}

export function LiveInterviewRoom({ interviewId }: { interviewId: string }) {
  const { data, jobs, reload } = useWorkspace();
  const router = useRouter();
  const session = data!.interviews.find((s) => s.id === interviewId);
  const question = session?.questions.find((q) => !q.answer);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!session)
    return (
      <EmptyState
        title="Session not found."
        description="This session is unavailable for your account."
      />
    );
  if (["completed", "evaluating"].includes(session.status))
    return (
      <>
        <PageHeading
          title="Your session is complete."
          description="Your report is saved or being prepared."
        />
        <Button asChild>
          <Link href={`/dashboard/interview/${session.id}/report`}>
            Open report
          </Link>
        </Button>
      </>
    );
  if (session.config.mode === "Spoken") return <SpokenRoom session={session} />;
  const remaining = session.deadline
    ? Math.max(0, Math.ceil((Date.parse(session.deadline) - now) / 1000))
    : null;
  const pending = jobs.some(
    (j) =>
      j.resource_id === session.id &&
      j.kind === "response" &&
      ["queued", "running"].includes(j.status),
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!question) return;
    setBusy(true);
    setError("");
    try {
      await api(`/interviews/${interviewId}/answers`, {
        method: "POST",
        headers: { "Idempotency-Key": requestKey.current },
        body: JSON.stringify({ question_id: question.id, text: draft }),
      });
      setDraft("");
      requestKey.current = crypto.randomUUID();
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (
      !confirm(
        "Complete this interview? Submitted answers will be evaluated; unanswered questions are marked unanswered.",
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/interviews/${interviewId}/complete`, { method: "POST" });
      await reload();
      router.push(`/dashboard/interview/${interviewId}/report`);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <>
      <div className="room-topbar">
        <div>
          <Badge>TEXT SESSION · {session.status}</Badge>
          <h1 className="mt-3">{session.config.role}</h1>
          <p>
            {session.config.type} · {session.config.difficulty} ·{" "}
            {session.config.duration} minutes
          </p>
        </div>
        <div>
          <p aria-live="off" className="text-primary">
            {remaining === null
              ? "Preparing questions"
              : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} remaining`}
          </p>
          <Button
            variant="secondary"
            disabled={busy || session.status !== "active"}
            onClick={finish}
          >
            Complete interview
          </Button>
        </div>
      </div>
      <JobErrors resource={session.id} />
      {error && (
        <p role="alert" className="text-error my-4">
          {error}
        </p>
      )}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 mt-6">
        <Panel>
          <h2 className="mb-5">Your interviewer</h2>
          {session.status === "generating" && (
            <Spinner label="Generating your questions. You can leave and return." />
          )}
          {session.questions.map((q) => (
            <div key={q.id} className="border-b border-border py-5">
              <p className="text-primary text-xs mb-3">{q.topic}</p>
              <h3>{q.prompt}</h3>
              {q.answer && (
                <>
                  <p className="text-muted whitespace-pre-wrap mt-4">
                    {q.answer}
                  </p>
                  {q.response && (
                    <p className="bg-elevated p-4 rounded-lg mt-4">
                      {q.response.message}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
          {pending && (
            <p role="status" className="text-muted mt-4">
              Interviewer is preparing a response…
            </p>
          )}
        </Panel>
        <Panel>
          <h2 className="mb-5">Your answer</h2>
          {question && session.status === "active" && remaining !== 0 ? (
            <form onSubmit={submit}>
              <p className="mb-4">{question.prompt}</p>
              <Field
                label="Type your answer"
                hint="Up to 2,000 characters. Unsubmitted drafts stay in memory and are lost on refresh. Submitted answers are saved to your account."
              >
                <textarea
                  rows={10}
                  minLength={10}
                  maxLength={2000}
                  required
                  value={draft}
                  disabled={busy || pending}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    requestKey.current = crypto.randomUUID();
                  }}
                />
              </Field>
              <Button className="mt-5" disabled={busy || pending}>
                {busy ? "Saving…" : "Submit answer"}
              </Button>
            </form>
          ) : (
            <p className="text-muted">
              {remaining === 0
                ? "Your deadline has passed. Complete the session to evaluate your saved answers."
                : "All available questions are answered. Complete the session when you are ready."}
            </p>
          )}
          <p className="text-xs text-subtle mt-6">
            Maximum six questions. Text-only feedback; no spoken delivery, body
            language or vocal assessment.
          </p>
        </Panel>
      </div>
    </>
  );
}

export function LiveReport({ interviewId }: { interviewId: string }) {
  const { data } = useWorkspace();
  const session = data!.interviews.find((s) => s.id === interviewId);
  if (!session)
    return (
      <EmptyState
        title="Report not found."
        description="This report is unavailable for your account."
      />
    );
  const report = session.report;
  return (
    <>
      <PageHeading
        eyebrow="A MOMENT TO REFLECT"
        title="You showed up. That’s progress."
        description={`${session.config.role} · ${session.config.type} · ${session.config.mode === "Spoken" ? "Spoken" : "Legacy text"} interview report`}
        action={
          report && (
            <Button
              onClick={() =>
                exportJson("mockmate-interview-report.json", session)
              }
            >
              Export report & history
            </Button>
          )
        }
      />
      <JobErrors resource={session.id} />
      {report ? (
        <>
          <h2 className="mb-5">Interview performance</h2>
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Panel>
              <ScoreRing score={report.overall} />
              <p className="text-muted mt-4">
                Coaching rubric: correctness and relevance 40%, reasoning and
                evidence 35%, text clarity and structure 25%. No voice, video or
                hiring prediction.
              </p>
              {report.rubric_version === "transcript-v2" && (
                <p className="text-sm text-muted mt-3">
                  Calculated average of all question marks; unanswered questions
                  receive zero. {report.answered} of {report.total_questions}{" "}
                  questions answered. Marks use the actual question and
                  difficulty; concise correct answers can earn full credit.
                </p>
              )}
            </Panel>
            <Panel>
              <CompetencyChart scores={report.scores} />
              {report.scores.map((s) => (
                <Progress key={s.skill} label={s.skill} value={s.score} />
              ))}
            </Panel>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Panel>
              <h2 className="mb-5">Strengths</h2>
              <CheckList items={report.strengths} />
            </Panel>
            <Panel>
              <h2 className="mb-5">Where to improve</h2>
              <CheckList items={report.improvements} warning />
            </Panel>
            <Panel className="md:col-span-2">
              <h2 className="mb-5">Practice recommendations</h2>
              <CheckList items={report.recommendations} />
            </Panel>
          </div>
          <Panel className="mt-6">
            <h2>Interview performance · Questions & confirmed answers</h2>
            {session.questions.map((q) => (
              <div key={q.id} className="border-b border-border py-5">
                <h3>{q.prompt}</h3>
                <p className="whitespace-pre-wrap text-muted mt-3">
                  {q.answer || "Unanswered"}
                  {q.user_corrected && (
                    <span className="block text-xs mt-2">
                      User-corrected transcript
                    </span>
                  )}
                </p>
                {q.user_corrected && q.original_transcript && (
                  <details className="text-sm mt-3">
                    <summary>Original transcription</summary>
                    <p>{q.original_transcript}</p>
                  </details>
                )}
                <p className="mt-3">
                  {
                    report.questions.find((f) => f.question_id === q.id)
                      ?.feedback
                  }
                </p>
                <p className="text-primary text-xs mt-2">
                  {report.questions.find((f) => f.question_id === q.id)?.score}
                  /100
                </p>
                {report.questions.find((f) => f.question_id === q.id)
                  ?.rubric && (
                  <div className="text-xs text-muted mt-3">
                    <p>
                      Correctness/relevance:{" "}
                      {
                        report.questions.find((f) => f.question_id === q.id)
                          ?.rubric?.correctness_relevance
                      }
                      /100 · Reasoning/evidence:{" "}
                      {
                        report.questions.find((f) => f.question_id === q.id)
                          ?.rubric?.reasoning_evidence
                      }
                      /100 · Text clarity/structure:{" "}
                      {
                        report.questions.find((f) => f.question_id === q.id)
                          ?.rubric?.clarity_structure
                      }
                      /100
                    </p>
                    {report.questions.find((f) => f.question_id === q.id)
                      ?.evidence && (
                      <p className="mt-2">
                        Answer evidence: “
                        {
                          report.questions.find((f) => f.question_id === q.id)
                            ?.evidence
                        }
                        ”
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Panel>
          {session.integrity && <IntegrityReport summary={session.integrity} />}
        </>
      ) : (
        <Panel>
          <p role="status">
            {session.status === "evaluating"
              ? "Your report is processing. It will appear here when ready. You can return later."
              : "Complete this session to receive a report."}
          </p>
          <Button asChild className="mt-4" variant="secondary">
            <Link href={`/interview-room/${session.id}`}>Back to session</Link>
          </Button>
        </Panel>
      )}
    </>
  );
}
