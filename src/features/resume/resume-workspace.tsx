"use client";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import {
  FileText,
  UploadCloud,
  ArrowRight,
  CheckCircle2,
  Download,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Panel,
  PageHeading,
  Badge,
  Field,
  Progress,
  ScoreRing,
  CheckList,
  EmptyState,
  Spinner,
  DemoNotice,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { resumeService } from "@/services/mock-services";
import { errorMessage } from "@/services/api-client";
import { useUsage } from "@/hooks/use-usage";
import { useDemoStore } from "@/stores/demo-store";
import { mockResume } from "@/data/mock-data";
import { dateLabel } from "@/lib/utils";
import type { ResumeAnalysis } from "@/types";
const MAX_PDF_BYTES = 5 * 1024 * 1024;
import { DEMO_MODE } from "@/lib/mode";
import { LiveResumes } from "@/features/live/resumes";
export function ResumeWorkspace({ analyze = false }: { analyze?: boolean }) {
  return DEMO_MODE ? (
    <DemoResumeWorkspace analyze={analyze} />
  ) : (
    <LiveResumes />
  );
}
function DemoResumeWorkspace({ analyze = false }: { analyze?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const allowance = useUsage();
  const { resumes, addResume } = useDemoStore();
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function choose(candidate?: File) {
    setError("");
    setProgress(0);
    if (!candidate) return;
    if (
      candidate.type !== "application/pdf" ||
      !candidate.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Choose a PDF file (.pdf).");
      return;
    }
    if (candidate.size === 0 || candidate.size > MAX_PDF_BYTES) {
      setError("Choose a non-empty PDF smaller than 5 MB.");
      return;
    }
    setFile(candidate);
    setPreview(URL.createObjectURL(candidate));
  }
  async function runAnalysis() {
    if (allowance.resumes.remaining === 0) {
      setError(
        `Demo allowance used. Renews ${new Date(allowance.resetAt!).toLocaleString()}.`,
      );
      return;
    }
    if (!file) {
      setError("Select a PDF before starting the demo analysis.");
      return;
    }
    setBusy(true);
    setProgress(10);
    const interval = setInterval(
      () => setProgress((p) => Math.min(90, p + 15)),
      180,
    );
    try {
      const result = await resumeService.analyze();
      const accepted = addResume({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        date: new Date().toISOString(),
        analysis: result,
      });
      if (!accepted)
        throw new Error(
          "Demo allowance used in another tab. Try again after renewal.",
        );
      setProgress(100);
      toast.success(
        "Sample analysis ready. Your PDF was not uploaded or read.",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      clearInterval(interval);
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR EXPERIENCE, CLEARLY TOLD"
        title={analyze ? "Make your resume work harder." : "Resume Analysis"}
        description="Explore what’s working, find the gaps, and tell a stronger story."
        action={
          !analyze && (
            <Button asChild>
              <Link href="/dashboard/resume/analyze">
                <UploadCloud size={16} />
                Analyze a resume
              </Link>
            </Button>
          )
        }
      />
      <p className="text-xs">
        {allowance.resumes.remaining} of 10 demo resume analyses remaining.{" "}
        {allowance.resetAt
          ? `Both allowances renew ${new Date(allowance.resetAt).toLocaleString()}.`
          : "The 24-hour window starts with your first use."}
      </p>
      <DemoNotice />
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 my-6">
        <Panel>
          <div className="panel-heading">
            <h2>Start with your resume</h2>
            <Badge tone="muted">PDF · UP TO 5 MB</Badge>
          </div>
          <div
            className={`upload-zone ${drag ? "upload-zone-drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              choose(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={33} strokeWidth={1.3} />
            <h3>Drop your resume here</h3>
            <p className="text-subtle text-xs">
              Or choose a PDF from your device.
            </p>
            <input
              ref={fileInput}
              aria-label="Resume PDF"
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <p className="text-subtle text-[10px]">
              Local preview only. File content is never analyzed.
            </p>
          </div>
          {error && (
            <p className="text-error text-xs mt-3" role="alert">
              {error}
            </p>
          )}
          {file && (
            <div className="flex items-center gap-3 mt-4 p-3 rounded-lg bg-elevated">
              <FileText className="text-primary" size={23} />
              <div className="min-w-0 flex-1">
                <p className="text-xs truncate">{file.name}</p>
                <p className="text-subtle text-[10px]">
                  {(file.size / 1024).toFixed(1)} KB · Ready for demo
                </p>
              </div>
              {preview && (
                <a
                  href={preview}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-[11px]"
                >
                  Preview PDF
                </a>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove selected PDF"
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setProgress(0);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                <X size={15} />
              </Button>
            </div>
          )}
          {progress > 0 && (
            <div className="mt-5">
              <Progress
                label={
                  progress === 100
                    ? "Demo analysis complete"
                    : "Simulating analysis — no upload"
                }
                value={progress}
              />
            </div>
          )}
          <Button className="w-full mt-5" onClick={runAnalysis} disabled={busy}>
            {busy ? (
              <Spinner label="Preparing sample analysis…" />
            ) : (
              <>
                <Sparkles size={15} />
                Run demo analysis
              </>
            )}
          </Button>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <h2>
              {resumes.length
                ? "Latest resume snapshot"
                : "A preview of your insights"}
            </h2>
            <Badge tone="muted">SIMULATED</Badge>
          </div>
          <div className="flex gap-7 items-center justify-center mb-7">
            <ScoreRing
              score={resumes[0]?.analysis.score ?? 81}
              label="Resume score"
            />
            <div>
              <p className="text-primary font-medium">
                A strong starting point.
              </p>
              <p className="text-subtle text-xs mt-2 max-w-40">
                Make your impact easier to see.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {(resumes[0]?.analysis ?? mockResume).skills
              .slice(0, 3)
              .map((s) => (
                <Progress key={s.skill} label={s.skill} value={s.score} />
              ))}
          </div>
          <Button asChild variant="secondary" className="w-full mt-7">
            <Link href="/dashboard/resume/improve">
              Explore improvements
              <ArrowRight size={14} />
            </Link>
          </Button>
        </Panel>
      </div>
      <Tabs
        tabs={[
          {
            value: "analysis",
            label: "Analysis & recommendations",
            content: (
              <ResumeResults analysis={resumes[0]?.analysis ?? mockResume} />
            ),
          },
          {
            value: "history",
            label: `Resume history (${resumes.length})`,
            content: (
              <Panel>
                {resumes.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>FILE</th>
                          <th>ANALYZED</th>
                          <th>DEMO SCORE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumes.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <FileText
                                size={14}
                                className="inline mr-2 text-primary"
                              />
                              {r.name}
                              <span className="block text-subtle text-[10px]">
                                {(r.size / 1024).toFixed(1)} KB · File content
                                not stored
                              </span>
                            </td>
                            <td>{dateLabel(r.date)}</td>
                            <td className="text-success">
                              {r.analysis.score}/100
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileText size={28} />}
                    title="Your story starts here."
                    description="Select a PDF and run a demo analysis. Its metadata and sample results will appear here."
                  />
                )}
              </Panel>
            ),
          },
        ]}
      />
    </>
  );
}
function ResumeResults({ analysis }: { analysis: ResumeAnalysis }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Panel>
        <h2 className="mb-5">What’s working</h2>
        <CheckList items={analysis.strengths} />
      </Panel>
      <Panel>
        <h2 className="mb-5">Where to focus next</h2>
        <CheckList items={analysis.improvements} warning />
      </Panel>
    </div>
  );
}
export function ResumeImprove() {
  if (!DEMO_MODE) return <LiveResumes improve />;
  return <ResumeImproveForm />;
}
function ResumeImproveForm() {
  const [original, setOriginal] = useState(
    "Built a web application using React and integrated APIs.",
  );
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  async function improve() {
    if (original.trim().length < 20) {
      toast.error(
        "Add at least 20 characters so you have a bullet to compare.",
      );
      return;
    }
    setBusy(true);
    await resumeService.analyze();
    setResult(
      "Designed and built a React application with reusable components, typed API boundaries, and clear loading and error states. Add your verified user count, performance change, or time saved to quantify the outcome.",
    );
    setBusy(false);
  }
  function download() {
    const blob = new Blob(
      [
        `Mockmate — sample improvement\n\nOriginal:\n${original}\n\nExample (not AI-generated):\n${result}`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mockmate-resume-notes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOUR IMPACT VISIBLE"
        title="Stronger words. A clearer story."
        description="Practice rewriting your experience with action, context, and impact."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/resume">Back to resume</Link>
          </Button>
        }
      />
      <DemoNotice />
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Panel>
          <h2 className="mb-5">Refine a project bullet</h2>
          <Field
            label="Your current bullet"
            hint="Use fictional or non-sensitive content. This text is not saved."
          >
            <textarea
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              rows={6}
              maxLength={3000}
            />
          </Field>
          <Button className="mt-5" onClick={improve} disabled={busy}>
            {busy ? (
              <Spinner label="Preparing example…" />
            ) : (
              <>
                <Sparkles size={15} />
                Show sample improvement
              </>
            )}
          </Button>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <h2>A possible direction</h2>
            <Badge tone="muted">PREWRITTEN EXAMPLE</Badge>
          </div>
          {result ? (
            <>
              <p className="text-muted leading-8 text-sm">{result}</p>
              <Button variant="secondary" onClick={download} className="mt-5">
                <Download size={15} />
                Download notes
              </Button>
            </>
          ) : (
            <EmptyState
              icon={<CheckCircle2 size={26} />}
              title="Make every bullet count."
              description="See a prewritten example, then adapt it with your own verified outcomes."
            />
          )}
        </Panel>
        <Panel className="lg:col-span-2">
          <h2 className="mb-6">A simple formula to try</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                title: "01 · Action",
                text: "Start with a strong verb: designed, built, optimized, or tested.",
              },
              {
                title: "02 · Context",
                text: "Explain what you built and the tools or decisions that mattered.",
              },
              {
                title: "03 · Impact",
                text: "Add a real outcome. Never invent metrics or accomplishments.",
              },
            ].map((x) => (
              <div key={x.title}>
                <h3 className="text-primary text-xs mb-2">{x.title}</h3>
                <p className="text-muted text-xs">{x.text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
