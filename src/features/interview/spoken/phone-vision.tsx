"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { api, type DTO } from "@/services/live-api";
import { Button } from "@/components/ui/button";

type LocalPhone = {
  ready: boolean;
  candidate: boolean;
  at: number;
  error: boolean;
};

export function usePhoneVision(
  sessionId: string,
  active: boolean,
  optedIn: boolean,
  video: RefObject<HTMLVideoElement | null>,
  stream: MediaStream | null,
  local: LocalPhone,
) {
  const [state, setState] = useState<DTO<"VisionState"> | null>(null);
  const [status, setStatus] = useState("Optional image checks are off.");
  const [history, setHistory] = useState<DTO<"VisionCheckView">[]>([]);
  const [nextCheck, setNextCheck] = useState(0);
  const latest = useRef(local);
  const requested = useRef(false);
  useEffect(() => {
    latest.current = local;
  }, [local]);
  useEffect(() => {
    const controller = new AbortController();
    void api<DTO<"VisionState">>(`/interviews/${sessionId}/vision`, {
      signal: controller.signal,
    })
      .then(setState)
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus(
            "Optional image checks are unavailable. Local face and tab checks remain available.",
          );
      });
    return () => controller.abort();
  }, [sessionId]);
  useEffect(() => {
    if (!active || !optedIn || !stream) return;
    const controller = new AbortController();
    let disposed = false,
      inFlight = false,
      lastSent = 0,
      nextAt = 0,
      lastVideoTime = -1,
      needsConfirmation = false;
    let interval = 20000,
      audit = 60000;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    const tick = async () => {
      const now = Date.now(),
        phone = latest.current;
      const element = video.current;
      if (
        disposed ||
        document.hidden ||
        inFlight ||
        !element ||
        element.readyState < 2 ||
        !context ||
        stream.getVideoTracks()[0]?.readyState !== "live" ||
        now < nextAt ||
        element.currentTime === lastVideoTime
      )
        return;
      const candidate =
        phone.ready && phone.candidate && performance.now() - phone.at < 6000;
      if (
        !requested.current &&
        !candidate &&
        !needsConfirmation &&
        lastSent &&
        now - lastSent < audit
      )
        return;
      requested.current = false;
      inFlight = true;
      lastVideoTime = element.currentTime;
      try {
        const scale = Math.min(
          1,
          640 / Math.max(element.videoWidth, element.videoHeight),
        );
        canvas.width = Math.max(1, Math.round(element.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(element.videoHeight * scale));
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const image = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.65),
        );
        if (disposed || controller.signal.aborted || !image) return;
        lastSent = now;
        nextAt = now + interval;
        setNextCheck(nextAt);
        setStatus("Checking a sampled camera image with Groq…");
        const form = new FormData();
        form.set("observed_at", new Date(now).toISOString());
        form.set("file", image, "camera-sample.jpg");
        const result = await api<DTO<"VisionState">>(
          `/interviews/${sessionId}/vision-checks`,
          {
            method: "POST",
            headers: { "Idempotency-Key": crypto.randomUUID() },
            body: form,
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(18000),
            ]),
          },
        );
        if (disposed) return;
        setState(result);
        needsConfirmation =
          result.warning_active || result.latest?.result === "visible";
        interval = Math.max(20000, result.interval_seconds * 1000);
        audit = Math.max(60000, result.audit_seconds * 1000);
        nextAt =
          Date.now() +
          (result.retry_after > 0 ? result.retry_after * 1000 + 250 : interval);
        setNextCheck(nextAt);
        if (result.latest)
          setHistory((previous) =>
            [
              result.latest!,
              ...previous.filter((c) => c.id !== result.latest!.id),
            ].slice(0, 8),
          );
        if (result.retry_after >= 60)
          setStatus(
            "AI image checks paused for provider capacity or availability. Local checks continue; retry is automatic.",
          );
        else if (result.latest?.status === "unavailable")
          setStatus(
            "AI image check unavailable. This is not a phone detection.",
          );
        else if (result.latest?.result === "visible")
          setStatus(
            result.warning_active
              ? "Phone visible on repeated camera samples. Please keep your practice area clear."
              : "Phone visible in the latest sample. Waiting for another clear sample before recording a warning.",
          );
        else if (result.latest?.result === "uncertain")
          setStatus(
            "The sampled image was uncertain. No phone warning was added.",
          );
        else
          setStatus(
            "No phone identified in the latest sample. Sampling can miss brief or obscured objects.",
          );
      } catch (error) {
        if (!disposed) {
          setStatus(
            error instanceof Error
              ? error.message
              : "AI image check unavailable. Local checks continue.",
          );
          nextAt = Date.now() + 60000;
          setNextCheck(nextAt);
        }
      } finally {
        context.clearRect(0, 0, canvas.width, canvas.height);
        inFlight = false;
      }
    };
    const timer = setInterval(() => void tick(), 1000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [sessionId, active, optedIn, video, stream]);
  async function disable() {
    const result = await api<DTO<"VisionState">>(
      `/interviews/${sessionId}/vision-consent`,
      { method: "PUT", body: JSON.stringify({ enabled: false }) },
    );
    setState(result);
    setStatus("External image checks are off.");
  }
  return {
    state,
    status,
    history,
    nextCheck,
    disable,
    checkNow: () => {
      requested.current = true;
    },
  };
}

export function PhoneVisionPanel({
  phone,
  local,
  onDisable,
}: {
  phone: ReturnType<typeof usePhoneVision>;
  local: LocalPhone;
  onDisable: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <section
      className="mt-5 border-t border-border pt-4 text-sm"
      aria-label="AI phone visibility checks"
    >
      <h3>AI phone visibility checks · {phone.state?.model || "Groq"}</h3>
      <p className="text-muted my-2">
        Local filter:{" "}
        {local.error
          ? "unavailable; periodic AI sampling continues"
          : !local.ready
            ? "loading"
            : local.candidate
              ? "possible phone visible"
              : "no phone candidate"}
        .
      </p>
      <p role="status">{phone.status}</p>
      <p className="text-xs text-muted my-2">
        {phone.state?.checks || 0} sampled image(s). Candidate checks are spaced
        at least {phone.state?.interval_seconds || 20}s apart; routine audits
        about every {phone.state?.audit_seconds || 60}s. Images are sent to Groq
        and are not saved by Mockmate. These checks cannot establish phone use
        or cheating.
      </p>
      {phone.nextCheck > 0 && (
        <p className="text-xs text-muted">
          Next eligible check: {new Date(phone.nextCheck).toLocaleTimeString()}
        </p>
      )}
      <div className="flex flex-wrap gap-2 my-3">
        <Button variant="secondary" onClick={phone.checkNow}>
          Check a sample when eligible
        </Button>
        <Button
          variant="ghost"
          onClick={() => void onDisable().catch((e) => setError(String(e)))}
        >
          Turn off image checks
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ol className="space-y-1 text-xs">
        {phone.history.map((check) => (
          <li key={check.id}>
            {new Date(check.received_at).toLocaleTimeString()} ·{" "}
            {check.status === "completed"
              ? check.result?.replaceAll("_", " ")
              : "unavailable"}
            {check.phase === "start" ? " · Warning recorded" : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}
