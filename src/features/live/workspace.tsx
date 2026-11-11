"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { browserAuth } from "@/lib/supabase/browser";
import { api, type DTO } from "@/services/live-api";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";

type State = {
  data: DTO<"Workspace"> | null;
  jobs: DTO<"JobView">[];
  reload: () => Promise<void>;
  updateInterview: (session: DTO<"InterviewView">) => void;
  updateTranscription: (
    sessionId: string,
    record: DTO<"TranscriptionView">,
  ) => void;
};
const Context = createContext<State | null>(null);
export function useWorkspace() {
  const state = useContext(Context);
  if (!state) throw new Error("Workspace provider is required.");
  return state;
}
export function useOptionalWorkspace() {
  return useContext(Context);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DTO<"Workspace"> | null>(null);
  const [jobs, setJobs] = useState<DTO<"JobView">[]>([]);
  const [error, setError] = useState("");
  const lifecycle = useRef<AbortController | null>(null);
  const issued = useRef(0);
  const committed = useRef(0);
  const updateInterview = useCallback((session: DTO<"InterviewView">) => {
    committed.current = ++issued.current;
    setData((previous) =>
      previous
        ? {
            ...previous,
            interviews: previous.interviews.some((s) => s.id === session.id)
              ? previous.interviews.map((s) =>
                  s.id === session.id ? session : s,
                )
              : [session, ...previous.interviews],
          }
        : previous,
    );
  }, []);
  const updateTranscription = useCallback(
    (sessionId: string, record: DTO<"TranscriptionView">) => {
      committed.current = ++issued.current;
      setData((previous) =>
        previous
          ? {
              ...previous,
              interviews: previous.interviews.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      transcriptions: [
                        ...(s.transcriptions || []).filter(
                          (t) => t.id !== record.id,
                        ),
                        record,
                      ],
                    }
                  : s,
              ),
            }
          : previous,
      );
    },
    [],
  );
  const reload = useCallback(async (signal?: AbortSignal) => {
    signal = signal ?? lifecycle.current?.signal;
    const ticket = ++issued.current;
    const [workspace, currentJobs] = await Promise.all([
      api<DTO<"Workspace">>("/workspace", { signal }),
      api<DTO<"JobView">[]>("/jobs", { signal }),
    ]);
    if (signal?.aborted || ticket < committed.current) return;
    committed.current = ticket;
    setData(workspace);
    setJobs(currentJobs);
    setError("");
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    let owner: string | undefined;
    const { data: listener } = browserAuth().auth.onAuthStateChange(
      (event, session) => {
        if (!session || (owner && owner !== session.user.id)) {
          controller.abort();
          setData(null);
          setJobs([]);
          location.replace("/login");
        }
        owner = session?.user.id;
      },
    );
    const refresh = () => {
      void reload(controller.signal).catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Unable to load your workspace.",
          );
      });
    };
    refresh();
    const timer = setInterval(refresh, 4000);
    window.addEventListener("focus", refresh);
    window.addEventListener("mockmate:usage-changed", refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("mockmate:usage-changed", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      listener.subscription.unsubscribe();
    };
  }, [reload]);
  useEffect(() => {
    const caps = data?.capabilities;
    if (!caps?.reset_at) return;
    // Relative to the server snapshot; changing the browser clock cannot grant capacity.
    const delay = Math.max(
      0,
      Date.parse(caps.reset_at) - Date.parse(caps.server_time),
    );
    const timer = setTimeout(
      () => {
        void reload().catch(() => {});
      },
      Math.min(delay + 50, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [data?.capabilities, reload]);
  return (
    <Context.Provider
      value={{ data, jobs, reload, updateInterview, updateTranscription }}
    >
      {error && (
        <div role="alert" className="panel m-4 text-error">
          {error}
          <Button
            onClick={() => void reload().catch((e) => setError(String(e)))}
            variant="secondary"
          >
            Retry
          </Button>
        </div>
      )}
      {data && (
        <div
          className="panel mx-4 mt-4 text-xs"
          role="region"
          aria-label="Daily allowances"
        >
          <p>
            {data.capabilities.resume.remaining} of{" "}
            {data.capabilities.resume.limit} resume analyses remaining ·{" "}
            {data.capabilities.interview.remaining} of{" "}
            {data.capabilities.interview.limit} video interviews remaining per{" "}
            {data.capabilities.window_hours} hours.
          </p>
          <p>
            {data.capabilities.reset_at
              ? `Both allowances renew ${new Date(data.capabilities.reset_at).toLocaleString()} (your local time).`
              : "Your 24-hour allowance window starts with your first use."}
          </p>
        </div>
      )}
      {data
        ? children
        : !error && (
            <div className="p-8">
              <Spinner label="Loading your account…" />
            </div>
          )}
    </Context.Provider>
  );
}

export function JobErrors({ resource }: { resource?: string }) {
  const { jobs, reload } = useWorkspace();
  const [error, setError] = useState("");
  const failed = jobs.filter(
    (j) => (!resource || j.resource_id === resource) && j.status === "failed",
  );
  return (
    <>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {failed.map((j) => (
        <div key={j.id} className="panel my-4" role="status">
          <p>{j.error || "Processing failed."}</p>
          {j.kind !== "transcribe" && (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await api(`/jobs/${j.id}/retry`, { method: "POST" });
                  await reload();
                  setError("");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Retry processing
            </Button>
          )}
        </div>
      ))}
    </>
  );
}
