import { api, type DTO } from "@/services/live-api";
export type Event = DTO<"ObservationInput">;
export type Kind = Event["kind"];
export type Config = {
  sustain_ms: number;
  recovery_ms: number;
  cooldown_ms: number;
  sample_ms: number;
  debounce_ms?: number;
};
export const messages: Record<Kind, string> = {
  no_face: "No face detected. Please return to the camera.",
  multiple_faces: "Multiple faces detected.",
  camera_unavailable: "Camera disconnected.",
  microphone_unavailable: "Microphone unavailable or disconnected.",
  tab_hidden: "Interview tab is no longer visible.",
  focus_lost: "Interview window lost focus.",
  detection_unavailable:
    "Face detection unavailable. Camera observations are interrupted.",
  coverage_gap:
    "Observation coverage interrupted. This interval could not be checked.",
};
type State = {
  since: number;
  last: number;
  recovery?: number;
  episode?: string;
  ended?: number;
};
export class Episodes {
  states = new Map<Kind, State>();
  constructor(
    public config: Config,
    public emit: (event: Event) => void,
  ) {}
  sample(
    kind: Kind,
    present: boolean,
    now = performance.now(),
    immediate = false,
  ) {
    let state = this.states.get(kind);
    if (!state) {
      state = { since: now, last: now };
      this.states.set(kind, state);
    }
    if (
      now - state.last > Math.max(5000, this.config.sample_ms * 5) &&
      !state.episode
    )
      state.since = now;
    state.last = now;
    if (present) {
      if (immediate && !state.episode) state.since = now;
      if (state.recovery !== undefined) {
        state.recovery = undefined;
        state.since = now;
      }
      const threshold = ["no_face", "multiple_faces"].includes(kind)
        ? this.config.sustain_ms
        : this.config.debounce_ms || 1000;
      if (
        !state.episode &&
        (immediate ||
          (now - state.since >= threshold &&
            (state.ended === undefined ||
              now - state.ended >= this.config.cooldown_ms)))
      ) {
        state.episode = crypto.randomUUID();
        this.emit({
          id: crypto.randomUUID(),
          episode_id: state.episode,
          kind,
          phase: "start",
          observed_at: new Date().toISOString(),
          duration_ms: null,
        });
      }
    } else {
      if (state.episode) {
        state.recovery ??= now;
        if (immediate || now - state.recovery >= this.config.recovery_ms) {
          this.emit({
            id: crypto.randomUUID(),
            episode_id: state.episode,
            kind,
            phase: "recovered",
            observed_at: new Date().toISOString(),
            duration_ms: Math.round(now - state.since),
          });
          state.episode = undefined;
          state.ended = now;
        }
      } else state.since = now;
    }
  }
}

export class EventQueue {
  pending: Event[] = [];
  gaps = 0;
  observedMs = 0;
  sending?: Promise<void>;
  closed = false;
  constructor(public session: string) {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(`observations:${session}`) || "null",
      );
      if (saved && Array.isArray(saved.pending)) {
        this.pending = saved.pending.slice(-150);
        this.gaps = Math.min(10000, Number(saved.gaps) || 0);
        this.observedMs = Math.min(3600000, Number(saved.observedMs) || 0);
      }
    } catch {
      this.gaps++;
    }
  }
  save() {
    if (this.closed) return;
    try {
      sessionStorage.setItem(
        `observations:${this.session}`,
        JSON.stringify({
          pending: this.pending,
          gaps: this.gaps,
          observedMs: this.observedMs,
        }),
      );
    } catch {
      this.gaps++;
    }
  }
  add(event: Event) {
    if (this.closed) return;
    if (this.pending.length >= 150) {
      this.pending.shift();
      this.gaps++;
    }
    this.pending.push(event);
    this.save();
  }
  flush(): Promise<void> {
    if (this.sending) return this.sending;
    this.sending = (async () => {
      while (this.pending.length) {
        const batch = this.pending.slice(0, 25);
        await api(`/interviews/${this.session}/observations`, {
          method: "POST",
          body: JSON.stringify({ events: batch }),
          signal: AbortSignal.timeout(5000),
        });
        this.pending.splice(0, batch.length);
        this.save();
      }
    })().finally(() => {
      this.sending = undefined;
    });
    return this.sending;
  }
  clear() {
    this.closed = true;
    this.pending = [];
    try {
      sessionStorage.removeItem(`observations:${this.session}`);
    } catch {
      /* no retained audio */
    }
  }
}
