"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, Bot, Play, Send, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { codingProblems } from "@/data/coding-data";
import { codingService } from "@/services/coding-service";
import { errorMessage } from "@/services/api-client";
import { useDemoStore } from "@/stores/demo-store";
import { useCodingIntegrity } from "@/hooks/use-coding-integrity";
import { codingConfig } from "@/config/coding";
import { formatTime } from "@/lib/utils";
import type { CodingRound as Round } from "@/types/coding";
import { Panel, Badge, Spinner, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { RoundEditor } from "./round-editor";
import { IntegrityPanel } from "./integrity-panel";
export function CodingRound({
  round,
  onNew,
}: {
  round: Round;
  onNew: () => void;
}) {
  const save = useDemoStore((s) => s.saveCodingRound);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [output, setOutput] = useState("");
  const [dialog, setDialog] = useState<"submit" | "end" | "reset" | null>(null);
  const [followup, setFollowup] = useState(0);
  const active = round.status === "active";
  const record = useCodingIntegrity(round.id, active);
  const problem = codingProblems.find((p) => p.id === round.problemId);
  const remaining = Math.max(
    0,
    Math.ceil(
      (Date.parse(round.startedAt) +
        round.durationMinutes * 60000 -
        (round.completedAt ? Date.parse(round.completedAt) : now)) /
        1000,
    ),
  );
  const expired = remaining === 0;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  function patch(changes: Partial<Round>) {
    // Read the latest session after async services so integrity events are never overwritten.
    const latest = useDemoStore
      .getState()
      .codingRounds.find((r) => r.id === round.id);
    if (latest) save({ ...latest, ...changes });
  }
  if (!problem)
    return (
      <EmptyState
        title="This sample problem is unavailable."
        description="Your saved round may reference an older fixture. Start a new round."
        action={<Button onClick={onNew}>New coding round</Button>}
      />
    );
  function validateSolution() {
    if (
      !problem ||
      round.drafts[round.language].trim().length < 10 ||
      round.drafts[round.language].trim() ===
        problem.starters[round.language].trim()
    ) {
      toast.error(
        "Type a solution or meaningful pseudocode before submitting.",
      );
      return false;
    }
    return true;
  }
  async function run() {
    setBusy("run");
    try {
      setOutput(await codingService.run());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function submit() {
    if (!validateSolution()) {
      setDialog(null);
      return;
    }
    setBusy("submit");
    try {
      const evaluation = await codingService.evaluate();
      patch({
        evaluation,
        status: "submitted",
        completedAt: new Date().toISOString(),
      });
      setDialog(null);
      toast.success("Sample coding feedback ready. No code was executed.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div
      className="coding-environment"
      aria-label="Coding interview environment"
      onCopy={(e) => {
        if (active) {
          e.preventDefault();
          record("copy", "A copy attempt in the coding interview was blocked.");
        }
      }}
      onCut={(e) => {
        if (active) {
          e.preventDefault();
          record(
            "copy",
            "An editor cut-to-clipboard attempt was blocked. Use Delete to remove selected code.",
          );
        }
      }}
      onContextMenu={(e) => {
        if (active) {
          e.preventDefault();
          record("context-menu", "The interview context menu was blocked.");
        }
      }}
    >
      <div className="coding-topbar">
        <div>
          <Badge tone={active ? "green" : "muted"}>
            {active
              ? "CODING INTERVIEW IN PROGRESS"
              : round.status === "submitted"
                ? "SUBMISSION COMPLETE"
                : "ROUND ENDED"}
          </Badge>
          <p className="text-subtle text-[10px] mt-2">
            Round {round.id.slice(-8)} · {round.language} · AI interviewer
            simulation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`font-mono flex items-center gap-2 text-sm ${expired ? "text-warning" : "text-muted"}`}
            role="timer"
            aria-label="Coding time remaining"
          >
            <Clock3 size={16} />
            {formatTime(remaining)}
          </span>
          {active ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={!!busy}
              onClick={() => setDialog("end")}
            >
              End round
            </Button>
          ) : (
            <Button size="sm" onClick={onNew}>
              Start another round
              <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </div>
      {active && expired && (
        <div className="demo-notice mb-5" role="status">
          Time is complete. Editing is paused. Submit your current solution for
          sample feedback, or end this round without submitting.
        </div>
      )}
      <div className="coding-round-grid">
        <Panel
          className="coding-problem"
          aria-label="Coding problem statement"
          style={{
            userSelect: active ? "none" : "auto",
            WebkitUserSelect: active ? "none" : "auto",
          }}
          onDragStart={(e) => e.preventDefault()}
        >
          <Badge tone="green">{problem.difficulty}</Badge>
          <h2 className="text-xl my-4">{problem.title}</h2>
          <p className="text-muted text-xs leading-7">{problem.statement}</p>
          <h3 className="text-sm mt-7 mb-4">Constraints</h3>
          <ul className="text-muted text-xs space-y-3 list-disc pl-4">
            {problem.constraints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <h3 className="text-sm mt-7 mb-4">Example</h3>
          <div className="terminal break-words">{problem.examples[0]}</div>
          <p className="text-subtle text-[10px] mt-6">
            Predefined problem · No AI question generation runs in this demo
          </p>
        </Panel>
        <div className="space-y-5 min-w-0">
          <RoundEditor
            language={round.language}
            value={round.drafts[round.language]}
            disabled={!active || expired || !!busy}
            onChange={(value) =>
              patch({ drafts: { ...round.drafts, [round.language]: value } })
            }
            onLanguageChange={(language) => patch({ language })}
            onPasteAttempt={(detail) => record("paste", detail)}
          />
          <div className="flex flex-wrap gap-3 justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={!active || expired || !!busy}
              onClick={() => setDialog("reset")}
            >
              <RotateCcw size={14} />
              Reset language draft
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!active || !!busy || expired}
                onClick={run}
              >
                {busy === "run" ? (
                  <Spinner label="Simulating…" />
                ) : (
                  <>
                    <Play size={14} />
                    Run demo
                  </>
                )}
              </Button>
              <Button
                size="sm"
                disabled={!active || !!busy}
                onClick={() => {
                  if (validateSolution()) setDialog("submit");
                }}
              >
                <Send size={14} />
                Submit solution
              </Button>
            </div>
          </div>
          <Panel>
            <div className="panel-heading">
              <h2 className="text-sm">Test cases & execution output</h2>
              <Badge tone="muted">SIMULATED</Badge>
            </div>
            <Tabs
              tabs={[
                {
                  value: "output",
                  label: "Output",
                  content: (
                    <div className="terminal min-h-28" role="status">
                      {busy === "run"
                        ? "Preparing fixed sample output…"
                        : output ||
                          "Run demo shows illustrative output.\nYour code will never be executed in Phase 1."}
                    </div>
                  ),
                },
                {
                  value: "tests",
                  label: "Test cases",
                  content: (
                    <div className="space-y-3">
                      {problem.examples.map((ex) => (
                        <div className="terminal break-words" key={ex}>
                          {ex}
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </Panel>
        </div>
        <aside className="space-y-5 min-w-0">
          <Panel>
            <div className="flex items-center gap-2 text-primary text-xs mb-5">
              <Bot size={18} />
              AI interviewer · scripted
            </div>
            <h2 className="text-sm">Let’s understand your thinking.</h2>
            <p className="text-muted text-xs leading-6 my-4">
              {problem.followups[followup]}
            </p>
            <label className="field">
              <span>Your reasoning</span>
              <textarea
                rows={4}
                placeholder="Explain the approach, trade-offs, or edge cases…"
                maxLength={codingConfig.maxFollowupLength}
                value={round.followupAnswers[String(followup)] ?? ""}
                readOnly={!active || expired || !!busy}
                onChange={(e) =>
                  patch({
                    followupAnswers: {
                      ...round.followupAnswers,
                      [String(followup)]: e.target.value,
                    },
                  })
                }
              />
            </label>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              disabled={!!busy}
              onClick={() => {
                if (
                  active &&
                  (round.followupAnswers[String(followup)]?.trim().length ??
                    0) < 10
                ) {
                  toast.error("Add a short explanation before moving on.");
                  return;
                }
                setFollowup((followup + 1) % problem.followups.length);
              }}
            >
              Next follow-up
              <ArrowRight size={13} />
            </Button>
            <p className="text-subtle text-[10px] mt-4">
              Question {followup + 1} / {problem.followups.length} · Typed
              explanations saved locally
            </p>
          </Panel>
          <IntegrityPanel round={round} />
        </aside>
      </div>
      {round.evaluation && (
        <Panel className="mt-6" aria-label="Coding evaluation">
          <div className="panel-heading">
            <h2>Sample coding evaluation</h2>
            <Badge tone="muted">NOT A GRADE</Badge>
          </div>
          <p className="text-muted text-xs mb-6">{round.evaluation.notice}</p>
          <div className="grid md:grid-cols-2 gap-5">
            {round.evaluation.dimensions.map((d) => (
              <div
                className="border border-border rounded-lg p-5"
                key={d.label}
              >
                <h3 className="text-primary text-sm mb-2">{d.label}</h3>
                <p className="text-muted text-xs leading-6">{d.feedback}</p>
              </div>
            ))}
          </div>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/dashboard/suggestions">
              See coding suggestions
              <ArrowRight size={14} />
            </Link>
          </Button>
        </Panel>
      )}
      {round.status === "ended" && (
        <div className="demo-notice mt-5">
          Round ended without submission. Your draft and integrity events are
          saved locally. No evaluation was created.
        </div>
      )}
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!busy && !open) setDialog(null);
        }}
        title={
          dialog === "submit"
            ? "Submit and finish this round?"
            : dialog === "reset"
              ? "Reset this language draft?"
              : "End without submitting?"
        }
        description={
          dialog === "submit"
            ? "Your code stays in this browser. The next screen displays predefined feedback, not executed tests or real AI evaluation."
            : dialog === "reset"
              ? "This replaces only the current language draft with its starter. Other language drafts remain saved."
              : "Your draft and integrity log will be saved, with no evaluation. You can start a new round afterward."
        }
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={() => setDialog(null)}
          >
            Keep working
          </Button>
          <Button
            disabled={!!busy}
            onClick={() => {
              if (dialog === "submit") {
                void submit();
                return;
              }
              if (dialog === "reset")
                patch({
                  drafts: {
                    ...round.drafts,
                    [round.language]: problem.starters[round.language],
                  },
                });
              else
                patch({
                  status: "ended",
                  completedAt: new Date().toISOString(),
                });
              setDialog(null);
            }}
          >
            {busy === "submit" ? (
              <Spinner label="Preparing sample review…" />
            ) : dialog === "submit" ? (
              "Submit & view sample feedback"
            ) : dialog === "reset" ? (
              "Reset draft"
            ) : (
              "End without submission"
            )}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
