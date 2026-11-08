import { ShieldCheck, ShieldAlert } from "lucide-react";
import { codingConfig } from "@/config/coding";
import type { CodingRound } from "@/types/coding";
import { Panel, Badge } from "@/components/ui/primitives";
export function IntegrityPanel({ round }: { round: CodingRound }) {
  const review = round.eventCount >= codingConfig.reviewThreshold;
  return (
    <Panel>
      <div className="flex justify-between items-center gap-3 mb-4">
        <h2 className="text-sm flex items-center gap-2">
          {review ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
          Interview integrity
        </h2>
        <Badge tone={round.eventCount ? "amber" : "green"}>
          {round.eventCount
            ? review
              ? "Review suggested"
              : "Event noted"
            : "No events noted"}
        </Badge>
      </div>
      <p className="text-muted text-xs" aria-live="polite">
        <strong data-testid="integrity-count">{round.eventCount}</strong>{" "}
        recorded events · Review indicator after {codingConfig.reviewThreshold}{" "}
        events
      </p>
      <p className="text-subtle text-[10px] mt-3">
        Events can have innocent explanations. No automatic accusation, score
        penalty, or disqualification is applied.
      </p>
      <ol className="integrity-events mt-4" aria-label="Integrity events">
        {round.events
          .slice(-8)
          .reverse()
          .map((event) => (
            <li key={event.id}>
              <time dateTime={event.timestamp}>
                {new Date(event.timestamp).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
              <span>{event.detail}</span>
            </li>
          ))}
      </ol>
      <p className="text-subtle text-[10px] mt-3">
        Latest 8 shown; up to {codingConfig.maxStoredEvents} stored locally.
        Browser events and plan access are not trusted security evidence.
      </p>
    </Panel>
  );
}
