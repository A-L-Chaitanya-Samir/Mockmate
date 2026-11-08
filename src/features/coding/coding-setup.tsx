"use client";
import { useState } from "react";
import { Code2, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { codingProblems } from "@/data/coding-data";
import { codingConfig } from "@/config/coding";
import { codingService } from "@/services/coding-service";
import { errorMessage } from "@/services/api-client";
import { useDemoStore } from "@/stores/demo-store";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import {
  Panel,
  Badge,
  Field,
  CheckList,
  Spinner,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import type { CodingLanguage } from "@/types/coding";
export function CodingSetup({ onStarted }: { onStarted: () => void }) {
  const [problemId, setProblemId] = useState(codingProblems[0].id);
  const [language, setLanguage] = useState<CodingLanguage>("JavaScript");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = useDemoStore((s) => s.saveCodingRound);
  const { can } = useFeatureAccess();
  async function start() {
    if (!accepted) {
      toast.error("Acknowledge the interview rules before starting.");
      return;
    }
    if (!can("codingRounds")) return;
    setBusy(true);
    try {
      save(await codingService.create(problemId, language));
      onStarted();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
      <Panel>
        <Badge>
          <Code2 size={12} />
          PRO · TECHNICAL INTERVIEW
        </Badge>
        <h2 className="text-2xl mt-5 mb-3">
          Think like an engineer.
          <br />
          Explain like a teammate.
        </h2>
        <p className="text-muted text-xs mb-7">
          A timed problem, a focused editor, and a scripted interviewer.
          Questions are predefined samples standing in for future AI generation.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Question set">
            <select
              value={problemId}
              onChange={(e) => setProblemId(e.target.value)}
            >
              {codingProblems.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Starting language">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as CodingLanguage)}
            >
              {codingConfig.languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-subtle text-xs mt-5">
          {codingConfig.durationMinutes} minutes · Timer continues while you are
          away · Drafts stay in this browser
        </p>
        <Button onClick={start} disabled={!accepted || busy} className="mt-7">
          {busy ? (
            <Spinner label="Preparing sample question…" />
          ) : (
            <>
              Start coding interview
              <ArrowRight size={15} />
            </>
          )}
        </Button>
      </Panel>
      <Panel>
        <h2 className="flex items-center gap-2 mb-5">
          <ShieldCheck size={19} className="text-primary" />
          Before you begin
        </h2>
        <CheckList
          items={[
            "Type your own solution. Editor paste, copy, cut, and drops are blocked during the round.",
            "Problem text cannot be selected or copied through ordinary interactions.",
            "Context-menu attempts, hidden tabs, and focus changes are recorded locally.",
            "Typing, selection, deletion, undo, and ordinary navigation remain available.",
          ]}
        />
        <p className="text-muted text-xs my-5">
          These are frontend deterrents. Screenshots, external devices,
          developer tools, and clipboard workarounds cannot be reliably
          prevented. Events are review signals, not proof of misconduct.
        </p>
        <label className="flex items-start gap-3 text-xs">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            I understand the coding interview rules and the limits of frontend
            safeguards.
          </span>
        </label>
        <p className="text-subtle text-[10px] mt-5">
          No secure execution, real AI evaluation, or trusted backend event
          recording is available in Phase 1.
        </p>
      </Panel>
    </div>
  );
}
