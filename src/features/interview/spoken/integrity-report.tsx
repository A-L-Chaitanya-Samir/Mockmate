import { Panel } from "@/components/ui/primitives";
import type { DTO } from "@/services/live-api";
import { messages } from "./observations";

export function IntegrityReport({
  summary,
}: {
  summary: DTO<"IntegritySummary">;
}) {
  const starts = summary.events.filter((e) => e.phase === "start");
  return (
    <Panel className="mt-6">
      <h2>Practice-integrity observations</h2>
      <p className="text-muted mt-3">
        {summary.device_check?.detector
          ? "Camera checks were reported available at device check."
          : "Camera checks were not confirmed available."}{" "}
        Browser observations are client-reported, can be incomplete or tampered
        with, and do not prove cheating. They do not affect the performance
        score.
      </p>
      <p className="my-3 text-sm">
        Configuration: {String(summary.configuration.version || "unknown")} ·
        Client-reported local detection coverage:{" "}
        {Math.round((summary.observed_ms || 0) / 1000)} seconds · Known
        collection gaps: {summary.gaps}. Continuous coverage is not
        independently verified. Background tabs, device interruptions and open
        episodes can leave unmeasured intervals.
      </p>
      <p className="my-3">{starts.length} observed episode(s)</p>
      {Object.entries(messages).map(([kind, label]) => {
        const count = starts.filter((e) => e.kind === kind).length;
        return count ? (
          <p key={kind} className="text-sm">
            {label} · {count}
          </p>
        ) : null;
      })}
      <ol className="mt-4 space-y-3">
        {starts.map((event) => {
          const recovery = summary.events.find(
            (e) =>
              e.episode_id === event.episode_id &&
              e.phase === "recovered" &&
              e.kind === event.kind,
          );
          return (
            <li key={event.id} className="border-t border-border pt-3 text-sm">
              <p>{messages[event.kind]}</p>
              <p className="text-muted">
                Client time: {new Date(event.observed_at).toLocaleString()} ·
                Server received: {new Date(event.received_at).toLocaleString()}
              </p>
              <p>
                {recovery
                  ? recovery.duration_ms == null
                    ? "Observation interrupted; recovery and duration unavailable."
                    : `Client-measured duration: ${(recovery.duration_ms / 1000).toFixed(1)}s`
                  : "Recovery or duration not recorded."}
              </p>
            </li>
          );
        })}
      </ol>
      {!starts.length && (
        <p>
          No supported warning episodes were received. This is not proof of
          uninterrupted observation.
        </p>
      )}
      {summary.vision && (
        <section className="mt-6 border-t border-border pt-5">
          <h3>Optional AI phone-visibility observations</h3>
          <p className="text-sm text-muted my-3">
            {summary.vision.provider} · {summary.vision.model}. These are AI
            interpretations of client-supplied camera samples, not verified
            evidence of phone use or cheating. Images are not saved by Mockmate.
            Brief, hidden or small phones can be missed; false positives are
            possible. Performance scores are unaffected.
          </p>
          <p>
            {summary.vision.checks} sample(s) · {summary.vision.visible}{" "}
            phone-visible sample(s) · {summary.vision.episodes}{" "}
            repeated-detection episode(s) · {summary.vision.uncertain} uncertain
            · {summary.vision.unavailable} unavailable/interrupted
          </p>
          <p className="text-xs text-muted mt-2">
            External image consent at completion:{" "}
            {summary.vision.consented ? "enabled" : "off"}. Continuous coverage
            and phone-visible durations are not measured.
          </p>
          <details className="mt-4">
            <summary>View sampled observation timeline</summary>
            <ol className="mt-3 space-y-2 text-sm">
              {summary.vision.samples.map((sample) => (
                <li key={sample.id}>
                  Server received{" "}
                  {new Date(sample.received_at).toLocaleString()} ·{" "}
                  {sample.status === "completed"
                    ? sample.result?.replaceAll("_", " ")
                    : `unavailable (${sample.error_code || sample.status})`}
                  {sample.phase === "start"
                    ? " · Repeated phone visibility warning"
                    : sample.phase === "recovered"
                      ? " · Later sample no longer showed a phone"
                      : ""}
                </li>
              ))}
            </ol>
          </details>
        </section>
      )}
    </Panel>
  );
}
