"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { FileText, UploadCloud } from "lucide-react";
import {
  Panel,
  PageHeading,
  Field,
  ScoreRing,
  CheckList,
  EmptyState,
  Spinner,
  Badge,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { api, exportJson, type DTO } from "@/services/live-api";
import { JobErrors, useWorkspace } from "./workspace";

export function LiveResumes({ improve = false }: { improve?: boolean }) {
  const { data, reload } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const uploadKey = useRef(crypto.randomUUID());
  const resumes = data!.resumes;
  const current = resumes.find((r) => r.id === selected) ?? resumes[0];
  const analysis = current?.analysis;
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<DTO<"ResumeView">>("/resumes", {
        method: "POST",
        body: new FormData(event.currentTarget),
        headers: { "Idempotency-Key": uploadKey.current },
      });
      setSelected(result.id);
      uploadKey.current = crypto.randomUUID();
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR EXPERIENCE, CLEARLY TOLD"
        title={improve ? "Resume improvements" : "Resume Analysis"}
        description="Evidence-based coaching from your own document. Scores follow our resume rubric; they are not ATS scores or hiring predictions."
        action={
          <Button asChild variant="secondary">
            <Link
              href={improve ? "/dashboard/resume" : "/dashboard/resume/improve"}
            >
              {improve ? "Resume history" : "Explore improvements"}
            </Link>
          </Button>
        }
      />
      <p className="demo-notice text-xs mb-6">
        Resume excerpts are sent to Groq. Email addresses, phone numbers and
        links are removed where detected; names and other personal information
        may remain. Scanned PDFs need OCR and are unsupported.
      </p>
      {error && (
        <p role="alert" className="text-error mb-4">
          {error}
        </p>
      )}
      <JobErrors />
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 my-6">
        <Panel>
          <div className="panel-heading">
            <h2>Start with your resume</h2>
            <Badge tone="muted">PDF · UP TO 5 MB</Badge>
          </div>
          <form onSubmit={upload} className="space-y-5">
            <div className="upload-zone">
              <UploadCloud size={33} />
              <h3>Choose your resume</h3>
              <input
                aria-label="Resume PDF"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
                disabled={busy}
                onChange={() => {
                  uploadKey.current = crypto.randomUUID();
                }}
              />
              <p className="text-xs text-subtle">
                Text PDFs · Up to 20 pages · Private storage
              </p>
            </div>
            <Field label="Target role (optional)">
              <input
                name="target_role"
                maxLength={120}
                placeholder="e.g. Frontend Developer"
                onChange={() => {
                  uploadKey.current = crypto.randomUUID();
                }}
              />
            </Field>
            <label className="flex items-start gap-3 text-xs">
              <input required type="checkbox" />I agree to external AI
              processing of my resume excerpts.
            </label>
            <Button
              className="w-full"
              disabled={busy || data!.capabilities.resumes_remaining === 0}
            >
              {busy ? (
                <Spinner label="Validating and uploading…" />
              ) : (
                "Analyze resume"
              )}
            </Button>
            <p className="text-xs text-subtle">
              {data!.capabilities.resumes_remaining} resume analyses
              remaining in this 24-hour window. Failed processing releases the reservation; retrying
              reserves it again.
            </p>
          </form>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <h2>Resume history</h2>
            <Badge>{resumes.length} SAVED</Badge>
          </div>
          {resumes.length ? (
            <div className="space-y-4">
              {resumes.map((r) => (
                <div key={r.id} className="border-b border-border pb-4">
                  <Button
                    variant="ghost"
                    className="max-w-full"
                    onClick={() => setSelected(r.id)}
                  >
                    <FileText size={15} />
                    <span className="truncate">{r.filename}</span>
                  </Button>
                  <p className="text-xs text-muted">
                    {new Date(r.created_at).toLocaleDateString()} · {r.status}
                    {r.analysis ? ` · ${r.analysis.score}/100` : ""}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {r.status === "ready" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            const link = await api<DTO<"FileLink">>(
                              `/resumes/${r.id}/file`,
                            );
                            location.assign(link.url);
                          } catch (e) {
                            setError(String(e));
                          }
                        }}
                      >
                        Download PDF
                      </Button>
                    )}
                    {r.analysis && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          exportJson("mockmate-resume-analysis.json", r)
                        }
                      >
                        Export analysis
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Delete this private PDF and all its analyses?",
                          )
                        )
                          return;
                        try {
                          await api(`/resumes/${r.id}`, { method: "DELETE" });
                          await reload();
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                  <JobErrors resource={r.id} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Your story starts here."
              description="Upload a text PDF to save your first analysis."
            />
          )}
        </Panel>
      </div>
      {analysis ? (
        <>
          <Panel className="mb-6">
            <div className="flex flex-wrap gap-8 items-center">
              <ScoreRing score={analysis.score} label="Resume quality rubric" />
              <div>
                <h2>{current.filename}</h2>
                <p className="text-muted mt-3">{analysis.role_relevance}</p>
                <p className="text-xs text-subtle mt-3">
                  Rubric: evidence and impact 30%, relevance 25%, structure 25%,
                  readability 20%.
                </p>
              </div>
            </div>
          </Panel>
          <div className="grid md:grid-cols-2 gap-6">
            <Panel>
              <h2 className="mb-5">What’s working</h2>
              <CheckList items={analysis.strengths} />
              <h3 className="mt-6 mb-3">Skills found</h3>
              <p>{analysis.skills.join(", ") || "No explicit skills found."}</p>
            </Panel>
            <Panel>
              <h2 className="mb-5">Where to focus next</h2>
              <CheckList items={analysis.improvements} warning />
              <h3 className="mt-6 mb-3">Missing information</h3>
              <CheckList items={analysis.missing_information} warning />
            </Panel>
            <Panel>
              <h2>Structure & readability</h2>
              <p className="text-muted mt-4">{analysis.structure}</p>
              <p className="text-muted mt-4">{analysis.readability}</p>
            </Panel>
            <Panel>
              <h2>Evidence from your PDF</h2>
              {analysis.evidence.map((e, i) => (
                <blockquote
                  key={i}
                  className="border-l-2 border-primary pl-4 mt-5"
                >
                  <p className="text-xs">“{e.quote}”</p>
                  <p className="text-muted mt-2">{e.feedback}</p>
                </blockquote>
              ))}
            </Panel>
          </div>
          {improve && (
            <Panel className="mt-6">
              <h2>Make improvements with verified evidence</h2>
              <p className="text-muted mt-3">
                Apply the suggestions above to the quoted parts of your resume.
                Add only achievements and measurements you can support. Upload
                the revised PDF for a new saved analysis.
              </p>
            </Panel>
          )}
        </>
      ) : (
        current && (
          <Panel>
            {current.status === "failed" ? <p role="alert">Analysis failed. Use Retry processing in the history.</p> : <Spinner label="Analysis is processing. You can leave this page and return later." />}
          </Panel>
        )
      )}
    </>
  );
}
