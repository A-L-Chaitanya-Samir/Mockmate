"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Clock3,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Bot,
  ArrowRight,
  ShieldCheck,
  Radio,
  ChevronDown,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useDemoStore } from "@/stores/demo-store";
import { useDemoReady } from "@/hooks/use-demo-ready";
import { useDevices } from "@/hooks/use-devices";
import { questionsFor, mockReport } from "@/data/mock-data";
import { interviewService } from "@/services/mock-services";
import { errorMessage } from "@/services/api-client";
import { formatTime } from "@/lib/utils";
import {
  Panel,
  Badge,
  ScoreRing,
  CheckList,
  Spinner,
  EmptyState,
  Skeleton,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { CompetencyChart } from "@/components/charts";
import type { InterviewSession } from "@/types";
export function InterviewRoom({ interviewId }: { interviewId: string }) {
  const ready = useDemoReady();
  const session = useDemoStore((s) =>
    s.sessions.find((x) => x.id === interviewId),
  );
  if (!ready) return <Skeleton />;
  if (!session)
    return (
      <EmptyState
        icon={<AudioLines size={36} />}
        title="This practice session isn’t here."
        description="Demo interviews live in the browser where they were created. Start a fresh session to continue."
        action={
          <Button asChild>
            <Link href="/dashboard/interview/setup">Set up an interview</Link>
          </Button>
        }
      />
    );
  if (session.status === "completed")
    return (
      <EmptyState
        title="You’ve wrapped up this session."
        description="Your sample report is ready to explore."
        action={
          <Button asChild>
            <Link href={`/dashboard/interview/${session.id}/report`}>
              View report
            </Link>
          </Button>
        }
      />
    );
  return <ActiveRoom key={session.id} initialSession={session} />;
}
function ActiveRoom({ initialSession }: { initialSession: InterviewSession }) {
  const router = useRouter();
  const saveSession = useDemoStore((s) => s.saveSession);
  const [session, setSession] = useState(initialSession);
  const latest = useRef(session);
  const [answer, setAnswer] = useState(
    initialSession.answers.find(
      (a) =>
        a.questionId ===
        questionsFor(initialSession.config.type)[initialSession.currentIndex]
          ?.id,
    )?.text ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [response, setResponse] = useState("");
  const [performanceOpen, setPerformanceOpen] = useState(true);
  const { videoRef, ...devices } = useDevices();
  const questions = questionsFor(session.config.type);
  const question =
    questions[Math.min(session.currentIndex, questions.length - 1)];
  const remaining = Math.max(0, session.config.duration * 60 - session.elapsed);
  const expired = remaining === 0;
  function update(next: InterviewSession) {
    latest.current = next;
    setSession(next);
    saveSession(next);
  }
  useEffect(() => {
    const timer = setInterval(() => {
      const current = latest.current;
      if (current.elapsed >= current.config.duration * 60) return;
      const next = { ...current, elapsed: current.elapsed + 1 };
      latest.current = next;
      setSession(next); // Persist periodically, rather than writing localStorage every second.
      if (next.elapsed % 5 === 0) saveSession(next);
    }, 1000);
    return () => {
      clearInterval(timer);
      saveSession(latest.current);
    };
  }, [saveSession]);
  function editAnswer(text: string) {
    setAnswer(text);
    const answers = [
      ...latest.current.answers.filter((a) => a.questionId !== question.id),
      { questionId: question.id, text },
    ];
    update({ ...latest.current, answers });
  }
  async function next() {
    if (answer.trim().length < 10) {
      toast.error(
        "Add at least 10 characters to practice a meaningful answer.",
      );
      return;
    }
    setBusy(true);
    setResponse("");
    try {
      const message = await interviewService.respond();
      setResponse(message);
      if (session.currentIndex === questions.length - 1) {
        setConfirm(true);
      } else {
        update({
          ...latest.current,
          currentIndex: latest.current.currentIndex + 1,
        });
        setAnswer("");
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function end() {
    setEnding(true);
    devices.stopAll();
    try {
      await interviewService.evaluate();
      update({ ...latest.current, status: "completed" });
      router.push(`/dashboard/interview/${session.id}/report`);
    } catch (e) {
      toast.error(errorMessage(e));
      setEnding(false);
    }
  }
  return (
    <>
      <div className="room-topbar">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="status-dot" />
            <span className="text-[10px] text-success">
              {expired ? "Practice time complete" : "Practice in progress"}
            </span>
            <Badge tone="muted">DEMO SESSION</Badge>
          </div>
          <h1>{session.config.role}</h1>
          <p>
            {session.config.type} interview · {session.config.difficulty} ·{" "}
            {session.config.mode} mode
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`flex gap-2 items-center font-mono text-sm ${remaining < 60 ? "text-warning" : "text-muted"}`}
            role="timer"
            aria-label="Time remaining"
          >
            <Clock3 size={16} />
            {formatTime(remaining)}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirm(true)}
          >
            <PhoneOff size={14} />
            End interview
          </Button>
        </div>
      </div>
      {expired && (
        <div className="demo-notice mb-4" role="status">
          Your practice time is complete. You can review your current answer and
          end the session to see the sample report.
        </div>
      )}
      <div className="room-grid">
        <div className="room-conversation">
          <div className="video-stage">
            <div className="video-grid" />
            <div className="video-status">
              <span className="status-dot" />
              <span>Mockmate interviewer · simulated</span>
            </div>
            <div className="interviewer-orb">
              <AudioLines size={46} strokeWidth={1.5} />
            </div>
            <div className="interviewer-title">
              <h2>Your space to think out loud.</h2>
              <p>
                {busy
                  ? "Preparing a scripted response…"
                  : "Take a breath. You’ve got this."}
              </p>
            </div>
            <div className="device-controls">
              <Tooltip
                label={
                  devices.mic ? "Mute microphone" : "Enable local microphone"
                }
              >
                <Button
                  aria-label={
                    devices.mic ? "Mute microphone" : "Enable microphone"
                  }
                  variant="ghost"
                  size="icon"
                  className={devices.mic ? "device-on" : ""}
                  disabled={devices.pending}
                  onClick={() => devices.toggle("mic")}
                >
                  {devices.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </Button>
              </Tooltip>
              <Tooltip
                label={
                  devices.camera
                    ? "Turn off camera"
                    : "Enable local camera preview"
                }
              >
                <Button
                  aria-label={
                    devices.camera ? "Turn off camera" : "Enable camera"
                  }
                  variant="ghost"
                  size="icon"
                  className={devices.camera ? "device-on" : ""}
                  disabled={devices.pending}
                  onClick={() => devices.toggle("camera")}
                >
                  {devices.camera ? (
                    <Video size={18} />
                  ) : (
                    <VideoOff size={18} />
                  )}
                </Button>
              </Tooltip>
              <Tooltip label="End interview">
                <Button
                  aria-label="End interview from video controls"
                  variant="destructive"
                  size="icon"
                  onClick={() => setConfirm(true)}
                >
                  <PhoneOff size={18} />
                </Button>
              </Tooltip>
            </div>
            <div className="camera-preview">
              {devices.camera ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  aria-label="Your local camera preview"
                />
              ) : (
                <UserRound size={29} strokeWidth={1.2} />
              )}
              <span>
                {devices.camera ? "You · local preview" : "Camera is off"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-subtle text-[10px]">
            <span className="flex items-center gap-1.5">
              <Radio size={12} className="text-success" />
              Local demo · no server connection
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} />
              Not recording
            </span>
            <span>
              Mic {devices.mic ? "on · no transcription" : "muted"} · Camera{" "}
              {devices.camera ? "on" : "off"}
            </span>
          </div>
          {devices.deviceError && (
            <div className="demo-notice text-warning" role="status">
              {devices.deviceError}
            </div>
          )}
          <Panel className="question-panel">
            <div className="flex items-center justify-between gap-3">
              <span className="text-primary text-xs flex items-center gap-2">
                <Bot size={17} />
                Your next question
              </span>
              <span className="text-subtle text-[10px]">
                {session.currentIndex + 1} / {questions.length} ·{" "}
                {question.topic}
              </span>
            </div>
            <h2 className="question-text">{question.prompt}</h2>
            <div
              className={`waveform ${busy ? "waveform-active" : ""}`}
              aria-hidden="true"
            >
              {Array.from({ length: 75 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    height:
                      5 + Math.abs(Math.sin(i * 0.7) * Math.sin(i * 0.13)) * 28,
                    animationDelay: `${i * 0.025}s`,
                  }}
                />
              ))}
            </div>
            <p className="text-center text-subtle text-[10px] mt-3">
              {busy
                ? "Scripted interviewer response…"
                : "Ready when you are · type your response below"}
            </p>
          </Panel>
          <Panel>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm">Your answer</h2>
              <span className="text-subtle text-[10px]">
                Text input in all demo modes
              </span>
            </div>
            <label>
              <span className="sr-only">Your interview answer</span>
              <textarea
                value={answer}
                onChange={(e) => editAnswer(e.target.value)}
                rows={5}
                maxLength={10000}
                placeholder="Walk through your thinking. A specific example is a great place to start…"
                disabled={busy || ending}
              />
            </label>
            <div className="flex flex-wrap justify-between gap-3 items-center mt-4">
              <span className="text-subtle text-[10px]">
                {answer.length}/10,000 · Saved in this browser
              </span>
              <Button onClick={next} disabled={busy || ending || expired}>
                {busy ? (
                  <Spinner label="One moment…" />
                ) : (
                  <>
                    {session.currentIndex === questions.length - 1
                      ? "Finish practice"
                      : "Next question"}
                    <ArrowRight size={14} />
                  </>
                )}
              </Button>
            </div>
          </Panel>
          {response && (
            <div className="demo-notice" role="status">
              <Bot size={15} />
              <span>{response}</span>
            </div>
          )}
          <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
            <SparkTip />
            <div>
              <span className="text-primary text-[10px]">
                A LITTLE GUIDANCE
              </span>
              <p className="text-muted text-xs mt-1">{question.guidance}</p>
            </div>
          </div>
          <Panel>
            <h2 className="text-sm mb-5">
              Session transcript <Badge tone="muted">TYPED RESPONSES</Badge>
            </h2>
            <div className="transcript">
              {session.answers.filter((a) => a.text.trim()).length ? (
                session.answers
                  .filter((a) => a.text.trim())
                  .map((a) => (
                    <div className="transcript-entry" key={a.questionId}>
                      <strong>
                        {questions.find((q) => q.id === a.questionId)?.prompt}
                      </strong>
                      <p>{a.text}</p>
                    </div>
                  ))
              ) : (
                <p className="text-subtle text-xs">
                  Your typed answers will appear here. No microphone
                  transcription occurs.
                </p>
              )}
            </div>
          </Panel>
        </div>
        <div>
          <button
            className="flex justify-between w-full items-center text-xs mb-3 text-muted"
            onClick={() => setPerformanceOpen(!performanceOpen)}
            aria-expanded={performanceOpen}
          >
            Practice insights{" "}
            <ChevronDown
              size={16}
              className={performanceOpen ? "rotate-180" : ""}
            />
          </button>
          {performanceOpen && (
            <aside className="performance">
              <Panel>
                <div className="flex items-center justify-between gap-2">
                  <h2>Your performance preview</h2>
                  <Badge tone="muted">SAMPLE</Badge>
                </div>
                <ScoreRing
                  score={mockReport.overall}
                  label="Illustrative score"
                  size={145}
                />
                <p className="text-center text-primary text-xs">
                  See what feedback could look like.
                </p>
                <div className="mini-scores">
                  {mockReport.scores
                    .filter((s) => s.skill !== "Problem solving")
                    .map((s) => (
                      <div className="mini-score" key={s.skill}>
                        <span>{s.skill}</span>
                        <strong>{s.score}</strong>
                        <small>Sample score</small>
                      </div>
                    ))}
                </div>
                <p className="text-subtle text-[9px] mt-4">
                  Fixed demo values. These do not evaluate your answers, voice,
                  or appearance.
                </p>
              </Panel>
              <Panel>
                <h2>Competency snapshot</h2>
                <CompetencyChart height={220} />
              </Panel>
              <Panel>
                <h2 className="mb-5">Keep these in mind</h2>
                <CheckList
                  items={[
                    "Structure your answer clearly",
                    "Use a specific example",
                    "Talk about outcomes and impact",
                  ]}
                />
                <p className="text-subtle text-[9px] mt-4">
                  Practice checklist · no live AI assessment
                </p>
              </Panel>
            </aside>
          )}
        </div>
      </div>
      <Dialog
        open={confirm}
        onOpenChange={(v) => {
          if (!ending) setConfirm(v);
        }}
        title="Ready to reflect?"
        description="End this demo interview and open a sample report. Your typed answers will stay in this browser. Scores are predefined, not an assessment of your performance."
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            disabled={ending}
            onClick={() => setConfirm(false)}
          >
            Keep practicing
          </Button>
          <Button disabled={ending} onClick={end}>
            {ending ? (
              <Spinner label="Preparing report…" />
            ) : (
              "End & view report"
            )}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
function SparkTip() {
  return <Bot size={18} className="text-primary shrink-0 mt-1" />;
}
