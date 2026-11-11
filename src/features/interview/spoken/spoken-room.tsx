"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Field, Panel, Spinner } from "@/components/ui/primitives";
import { api, type DTO } from "@/services/live-api";
import { JobErrors, useWorkspace } from "@/features/live/workspace";
import { useCapture, useFaceDetector } from "./media";
import { useRecorder } from "./recorder";
import { PhoneVisionPanel, usePhoneVision } from "./phone-vision";
import {
  Episodes,
  EventQueue,
  messages,
  type Config,
  type Kind,
  type Event as ObservationEvent,
} from "./observations";

function AudioPreview({
  blob,
  onListened,
}: {
  blob: Blob;
  onListened?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    if (audio.current) audio.current.src = next;
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return (
    <audio
      ref={audio}
      aria-label="Review recorded audio"
      controls
      onEnded={onListened}
      className="w-full my-3"
    />
  );
}

export function SpokenRoom({ session }: { session: DTO<"InterviewView"> }) {
  const { jobs, reload } = useWorkspace();
  const router = useRouter();
  const capture = useCapture();
  const [phoneConsent, setPhoneConsent] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const { sample_ms, sustain_ms, recovery_ms, cooldown_ms, debounce_ms } =
    session.observation_config || {};
  const config = useMemo<Config>(
    () => ({
      sample_ms: Number(sample_ms) || 750,
      sustain_ms: Number(sustain_ms) || 4000,
      recovery_ms: Number(recovery_ms) || 2000,
      cooldown_ms: Number(cooldown_ms) || 10000,
      debounce_ms: Number(debounce_ms) || 1000,
    }),
    [sample_ms, sustain_ms, recovery_ms, cooldown_ms, debounce_ms],
  );
  const face = useFaceDetector(
    capture.stream,
    video,
    config.sample_ms || 750,
    typeof session.observation_config?.model_path === "string"
      ? session.observation_config.model_path
      : undefined,
    typeof session.observation_config?.min_confidence === "number"
      ? session.observation_config.min_confidence
      : undefined,
    phoneConsent,
  );
  const test = useRecorder(capture.stream, 10);
  const [camera, setCamera] = useState("");
  const [mic, setMic] = useState("");
  const [approved, setApproved] = useState(false);
  const [consent, setConsent] = useState(false);
  const [tested, setTested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [activity, setActivity] = useState<ObservationEvent[]>([]);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [networkWarning, setNetworkWarning] = useState("");
  const [now, setNow] = useState(Date.now);
  const queue = useRef<EventQueue | null>(null);
  const ending = useRef(false);
  const refreshGap = useRef(!!session.device_check);
  const [devicesLive, setDevicesLive] = useState(false);
  const latest = useRef({ face, stream: capture.stream });
  useEffect(() => {
    latest.current = { face, stream: capture.stream };
  }, [face, capture.stream]);
  const active =
    approved &&
    session.status === "active" &&
    (!session.deadline || Date.parse(session.deadline) > now);
  const phone = usePhoneVision(
    session.id,
    active,
    phoneConsent,
    video,
    capture.stream,
    face.phone,
  );
  const remaining = session.deadline
    ? Math.max(0, Math.ceil((Date.parse(session.deadline) - now) / 1000))
    : null;
  const stopCapture = capture.stop;
  useEffect(() => {
    if (remaining === 0) {
      stopCapture();
      window.speechSynthesis?.cancel();
    }
  }, [remaining, stopCapture]);
  const question = session.questions.find((q) => !q.answer);
  const pending = jobs.some(
    (j) =>
      j.resource_id === session.id &&
      j.kind === "response" &&
      ["queued", "running"].includes(j.status),
  );
  useEffect(() => {
    if (video.current) {
      video.current.srcObject = capture.stream;
      void video.current.play().catch(() => {});
    }
  }, [capture.stream]);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setDevicesLive(
        !!latest.current.stream &&
          latest.current.stream
            .getTracks()
            .every((t) => t.readyState === "live" && !t.muted),
      );
    }, 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!active) return;
    const events = new EventQueue(session.id);
    queue.current = events;
    const episodes = new Episodes(config, (event) => {
      events.add(event);
      if (event.phase === "start") {
        setWarning(messages[event.kind]);
        setActivity((previous) => [event, ...previous].slice(0, 20));
        if (event.kind === "tab_hidden") setTabSwitches((count) => count + 1);
      } else
        setWarning(
          event.kind === "tab_hidden"
            ? "Returned to the interview tab. A tab switch was recorded."
            : `Observation recovered: ${event.kind.replaceAll("_", " ")}.`,
        );
    });
    if (refreshGap.current) {
      events.gaps++;
      events.save();
      refreshGap.current = false;
    }
    let lastTick = performance.now();
    const sample = () => {
      if (ending.current) return;
      const stamp = performance.now();
      const { face: currentFace, stream } = latest.current;
      const cameraTrack = stream?.getVideoTracks()[0];
      const micTrack = stream?.getAudioTracks()[0];
      const cameraLost =
        !cameraTrack || cameraTrack.readyState !== "live" || cameraTrack.muted;
      const micLost =
        !micTrack || micTrack.readyState !== "live" || micTrack.muted;
      const hidden = document.hidden;
      const interrupted = stamp - lastTick > 5000;
      const detectorReady =
        currentFace.ready &&
        stamp - currentFace.lastInference.current <=
          Math.max(2000, config.sample_ms * 3);
      if (!hidden && !cameraLost && detectorReady && stamp - lastTick <= 1500)
        events.observedMs = Math.min(
          3600000,
          events.observedMs + Math.round(stamp - lastTick),
        );
      episodes.sample("tab_hidden", hidden, stamp);
      episodes.sample("focus_lost", !hidden && !document.hasFocus(), stamp);
      episodes.sample("camera_unavailable", cameraLost, stamp);
      episodes.sample("microphone_unavailable", micLost, stamp);
      episodes.sample(
        "detection_unavailable",
        !hidden && !cameraLost && !detectorReady,
        stamp,
      );
      if (interrupted && !hidden) {
        events.gaps++;
        events.save();
      }
      lastTick = stamp;
      if (!hidden && !cameraLost && detectorReady && !interrupted) {
        episodes.sample("no_face", currentFace.faces === 0, stamp);
        episodes.sample("multiple_faces", (currentFace.faces ?? 0) > 1, stamp);
      } else {
        // Durations spanning an unobserved interval cannot be measured reliably.
        for (const kind of ["no_face", "multiple_faces"] as Kind[]) {
          const state = episodes.states.get(kind);
          if (state?.episode)
            events.add({
              id: crypto.randomUUID(),
              episode_id: state.episode,
              kind,
              phase: "recovered",
              observed_at: new Date().toISOString(),
              duration_ms: null,
            });
          if (state) {
            if (state.episode) state.ended = stamp;
            state.episode = undefined;
            state.recovery = undefined;
            state.since = stamp;
            state.last = stamp;
          }
        }
      }
    };
    const timer = setInterval(sample, 500);
    const flush = setInterval(() => {
      void events
        .flush()
        .then(() => setNetworkWarning(""))
        .catch(() =>
          setNetworkWarning(
            "Observations waiting for network. Retries are bounded; gaps will be reported.",
          ),
        );
    }, 5000);
    const visibilityChanged = () => {
      if (ending.current) return;
      const stamp = performance.now();
      // Capture the transition synchronously: hidden tabs may suspend every timer.
      episodes.sample("tab_hidden", document.hidden, stamp, true);
      if (document.hidden) episodes.sample("focus_lost", false, stamp, true);
      sample();
      void events
        .flush()
        .catch(() =>
          setNetworkWarning(
            "Observations waiting for network. Retries are bounded; gaps will be reported.",
          ),
        );
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("focus", sample);
    window.addEventListener("blur", sample);
    const leaving = () => {
      events.gaps++;
      events.save();
    };
    window.addEventListener("pagehide", leaving);
    return () => {
      clearInterval(timer);
      clearInterval(flush);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("focus", sample);
      window.removeEventListener("blur", sample);
      window.removeEventListener("pagehide", leaving);
      // Navigation may leave a coverage gap; queued metadata survives in this tab.
      leaving();
    };
  }, [active, session.id, config]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      await api(`/interviews/${session.id}/device-check`, {
        method: "POST",
        body: JSON.stringify({
          camera: true,
          microphone: true,
          detector: true,
          audio_test: true,
          consent: true,
          phone_vision: phoneConsent,
        }),
      });
      test.discard();
      setApproved(true);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    ending.current = true;
    setBusy(true);
    setError("");
    try {
      const events = queue.current;
      if (events) await events.flush().catch(() => {});
      const gaps = Math.min(
        10000,
        (events?.gaps || 0) + (events?.pending.length || 0),
      );
      await api(
        `/interviews/${session.id}/complete?observation_gaps=${gaps}&observed_ms=${events?.observedMs || 0}`,
        { method: "POST" },
      );
      events?.clear();
      test.stop();
      capture.stop();
      window.speechSynthesis?.cancel();
      await reload();
      router.push(`/dashboard/interview/${session.id}/report`);
    } catch (e) {
      ending.current = false;
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <>
      <div className="room-topbar">
        <div>
          <Badge>CAMERA-ON SPOKEN PRACTICE</Badge>
          <h1 className="mt-3">{session.config.role}</h1>
          <p>
            {session.config.type} · {session.config.difficulty}
          </p>
        </div>
        <div>
          <p>
            {remaining === null
              ? "Deadline starts after checks and questions are ready"
              : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} remaining`}
          </p>
          {approved && (
            <Button
              variant="secondary"
              disabled={busy || session.status !== "active"}
              onClick={() => void finish()}
            >
              Complete interview
            </Button>
          )}
        </div>
      </div>
      <JobErrors resource={session.id} />
      {(error || capture.error) && (
        <p role="alert" className="text-error my-4">
          {error || capture.error}
        </p>
      )}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Panel>
          <h2>{approved ? "Your camera" : "Camera & microphone check"}</h2>
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            aria-label="Live camera preview"
            className="w-full aspect-video rounded-xl bg-black my-4 object-cover"
          />
          <label className="block text-sm">
            Microphone input level{" "}
            <meter min="0" max="100" value={capture.level} className="w-full" />
          </label>
          <p role="status" className="text-sm my-3">
            Face detector: {face.status}
            {face.ready ? ` · ${face.faces} face(s) in this frame` : ""}
          </p>
          {approved && (
            <p className="text-xs text-muted">
              {face.ready
                ? "Local face observations available"
                : "Face observations unavailable"}{" "}
              · Client-reported practice checks
            </p>
          )}
          {!test.recording && (
            <div className="grid sm:grid-cols-2 gap-3 my-4">
              <Field label="Camera">
                <select
                  disabled={approved}
                  value={camera}
                  onChange={(e) => {
                    setCamera(e.target.value);
                    setTested(false);
                  }}
                >
                  <option value="">Default camera</option>
                  {capture.devices
                    .filter((d) => d.kind === "videoinput")
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "Camera"}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Microphone">
                <select
                  disabled={approved}
                  value={mic}
                  onChange={(e) => {
                    setMic(e.target.value);
                    setTested(false);
                  }}
                >
                  <option value="">Default microphone</option>
                  {capture.devices
                    .filter((d) => d.kind === "audioinput")
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "Microphone"}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          )}
          {!approved && (
            <Button
              variant="secondary"
              disabled={test.recording || busy}
              onClick={() => {
                setTested(false);
                test.discard();
                void capture.open(camera, mic);
              }}
            >
              Enable / retry selected devices
            </Button>
          )}
          {approved && (!devicesLive || !face.ready) && (
            <Button
              variant="secondary"
              onClick={() => {
                setApproved(false);
                setTested(false);
              }}
            >
              Retry device checks
            </Button>
          )}
          {warning && approved && (
            <p
              role="status"
              className="border border-border rounded-lg p-3 mt-4"
            >
              {warning}
            </p>
          )}
          {networkWarning && approved && (
            <p role="status" className="text-muted mt-3">
              {networkWarning}
            </p>
          )}
          {approved && (
            <section
              className="mt-5 text-sm"
              aria-label="Live practice observations"
            >
              <h3>Live practice observations</h3>
              <p className="my-2">Tab switches this visit: {tabSwitches}</p>
              <ol className="space-y-2">
                {activity.map((event) => (
                  <li key={event.id}>
                    <time className="text-muted mr-2">
                      {new Date(event.observed_at).toLocaleTimeString()}
                    </time>
                    {messages[event.kind]}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted mt-3">
                Checks cover tab visibility, window focus, device availability
                and face count. Phone visibility uses optional, separately
                consented image checks; phone use is not inferred.
              </p>
            </section>
          )}
          {approved && phoneConsent && (
            <PhoneVisionPanel
              phone={phone}
              local={face.phone}
              onDisable={async () => {
                setPhoneConsent(false);
                try {
                  await phone.disable();
                } catch (e) {
                  setError(String(e));
                }
              }}
            />
          )}
          <p className="text-xs text-muted mt-5">
            Face checks run locally. Optional AI phone checks send sampled
            images to Groq only with your consent. No full video recording,
            screenshots or face identities are saved by Mockmate. Browser
            observations can be incomplete or tampered with and do not prove
            cheating.
          </p>
        </Panel>
        <Panel>
          {!approved ? (
            <>
              <h2>Before you begin</h2>
              <p className="text-muted my-4">
                Allow camera and microphone access in your browser. Use
                headphones for optional question playback. Record a short audio
                test and listen back; it stays in this browser and is discarded.
              </p>
              <Button
                disabled={!devicesLive || busy}
                variant="secondary"
                onClick={() => {
                  if (test.recording) test.stop();
                  else {
                    test.start();
                    setTested(false);
                  }
                }}
              >
                {test.recording
                  ? `Stop audio test (${test.seconds}s)`
                  : "Record audio test"}
              </Button>
              {test.error && <p role="alert">{test.error}</p>}
              {test.blob && (
                <>
                  <AudioPreview
                    blob={test.blob}
                    onListened={() => setTested(true)}
                  />
                  <Button variant="ghost" onClick={() => test.discard()}>
                    Discard test
                  </Button>
                </>
              )}
              <p className="text-xs my-3">
                {tested
                  ? "Audio test reviewed."
                  : "Listen to the complete test recording to finish the audio check."}
              </p>
              <label className="flex gap-3 text-sm my-5">
                <input
                  type="checkbox"
                  checked={phoneConsent}
                  disabled={!phone.state?.available || busy}
                  onChange={(e) => setPhoneConsent(e.target.checked)}
                />
                Enable optional AI phone-visibility checks. I consent to
                selected camera images being sent to Groq. A local object filter
                limits uploads; audit samples are also sent. Mockmate does not
                save the images. Checks can miss objects or be wrong and do not
                establish phone use or cheating.
              </label>
              {!phone.state?.available && (
                <p className="text-xs text-muted">
                  External image checks are currently unavailable. Standard
                  spoken practice remains available.
                </p>
              )}
              <label className="flex gap-3 text-sm my-5">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I agree to external transcription of answer audio, AI processing
                of confirmed transcripts, and local camera observations.
                Temporary audio is deleted after processing, failure, completion
                or expiry.
              </label>
              <Button
                disabled={
                  busy ||
                  !devicesLive ||
                  !face.ready ||
                  !tested ||
                  !consent ||
                  test.recording ||
                  !["active", "generating"].includes(session.status)
                }
                onClick={() => void start()}
              >
                {busy ? "Starting…" : "Start camera-on interview"}
              </Button>
              <p className="text-xs text-muted mt-4">
                Camera and microphone are required. There is no automatic text
                fallback. Saved answers survive refresh; an in-progress
                recording may be lost.
              </p>
            </>
          ) : (
            <>
              {session.status === "generating" && (
                <Spinner label="Generating interview questions…" />
              )}
              {pending && (
                <p role="status" className="mb-4 text-sm text-muted">
                  Your submitted answer is saved. AI feedback is processing; you
                  can continue answering the next question.
                </p>
              )}
              {question && remaining !== 0 && session.status === "active" && (
                <SpokenAnswer
                  key={question.id}
                  question={question}
                  session={session}
                  stream={capture.stream}
                  enabled={devicesLive && face.ready && !busy}
                />
              )}
              {!question && (
                <p>
                  All available questions are answered. Complete your interview
                  to save your analysis.
                </p>
              )}
              {remaining === 0 && (
                <p role="status">
                  Your server deadline has passed. Saved answers will be
                  evaluated. Complete the interview to open your report.
                </p>
              )}
              <div className="mt-6 space-y-5">
                {session.questions
                  .filter((q) => q.answer)
                  .map((q) => (
                    <details key={q.id}>
                      <summary>{q.prompt}</summary>
                      <p className="whitespace-pre-wrap text-muted my-3">
                        {q.answer}
                      </p>
                      {q.response && <p>{q.response.message}</p>}
                    </details>
                  ))}
              </div>
            </>
          )}
        </Panel>
      </div>
      <p className="mt-5 text-sm">
        <Link href="/dashboard/interview">Back to saved interviews</Link>
      </p>
    </>
  );
}

function SpokenAnswer({
  question,
  session,
  stream,
  enabled,
}: {
  question: DTO<"QuestionView">;
  session: DTO<"InterviewView">;
  stream: MediaStream | null;
  enabled: boolean;
}) {
  const { updateInterview, updateTranscription } = useWorkspace();
  const [draft, setDraft] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const key = useRef(crypto.randomUUID());
  const answerKey = useRef(crypto.randomUUID());
  const records = (session.transcriptions || []).filter(
    (t) => t.question_id === question.id,
  );
  const processing = records.find((t) => t.status === "processing");
  const ready = records.filter((t) => t.status === "ready").at(-1);
  async function transcribe(audio: Blob | null) {
    if (!audio) return;
    setBusy(true);
    setError("");
    try {
      if (records.find((t) => t.id === selected)?.status === "failed")
        key.current = crypto.randomUUID();
      const form = new FormData();
      form.set("question_id", question.id);
      form.set("file", audio, "answer");
      const result = await api<DTO<"TranscriptionView">>(
        `/interviews/${session.id}/transcriptions`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key.current },
          body: form,
        },
      );
      setSelected(result.id);
      setDraft(null);
      updateTranscription(session.id, result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const recorder = useRecorder(stream, 120, (audio) => void transcribe(audio));
  const transcription = selected
    ? records.find((t) => t.id === selected)
    : !recorder.blob && !recorder.recording
      ? ready
      : undefined;
  const original = transcription?.original_text || "";
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  async function submit() {
    if (!transcription) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api<DTO<"InterviewView">>(
        `/interviews/${session.id}/answers`,
        {
          method: "POST",
          headers: { "Idempotency-Key": answerKey.current },
          body: JSON.stringify({
            question_id: question.id,
            text: draft ?? original,
            transcription_id: transcription.id,
          }),
        },
      );
      updateInterview(saved);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function speak() {
    const synth = window.speechSynthesis;
    if (!synth) {
      setError(
        "Spoken question playback is unavailable. Read the visible question.",
      );
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(question.prompt);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }
  return (
    <div>
      <p className="text-sm text-primary mb-3">
        Question {session.questions.findIndex((q) => q.id === question.id) + 1}{" "}
        of {session.questions.length}
      </p>
      <Badge>{question.topic}</Badge>
      <h2 className="my-4">{question.prompt}</h2>
      <div className="flex flex-wrap gap-3 my-4">
        <Button
          variant="ghost"
          disabled={recorder.recording || busy || !!processing}
          onClick={
            speaking
              ? () => {
                  window.speechSynthesis.cancel();
                  setSpeaking(false);
                }
              : speak
          }
        >
          {speaking ? "Stop question playback" : "Hear question"}
        </Button>
        <Button
          disabled={
            (!enabled && !recorder.recording) ||
            busy ||
            !!processing ||
            speaking
          }
          onClick={() => {
            if (recorder.recording) recorder.stop();
            else {
              key.current = crypto.randomUUID();
              answerKey.current = crypto.randomUUID();
              setSelected(null);
              setDraft(null);
              recorder.start();
            }
          }}
        >
          {recorder.recording
            ? `Stop & transcribe answer · ${recorder.seconds}s`
            : recorder.blob || transcription
              ? "Re-record answer"
              : "Start answering"}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Stop recording to transcribe automatically, then review and select
        “Submit answer & next question”. Up to 120 seconds per answer. Audio
        alone is sent through the authenticated backend for transcription.
        Confirmed transcripts are saved; answer-quality feedback assesses text
        only.
      </p>
      {(error || recorder.error) && (
        <p role="alert" className="text-error my-3">
          {error || recorder.error}
        </p>
      )}
      {busy && recorder.blob && !processing && !original && (
        <Spinner label="Uploading your recorded answer for transcription…" />
      )}
      {recorder.blob && !recorder.recording && (
        <>
          <AudioPreview blob={recorder.blob} />
          {(error || records.at(-1)?.status === "failed") && (
            <Button
              variant="secondary"
              disabled={busy || !!processing}
              onClick={() => void transcribe(recorder.blob)}
            >
              {busy ? "Uploading…" : "Retry transcription"}
            </Button>
          )}
        </>
      )}
      {processing && (
        <p role="status" className="my-4">
          Transcribing your answer…{" "}
          {processing.error || "You can refresh and return to this turn."}
        </p>
      )}
      {!processing && records.at(-1)?.status === "failed" && (
        <p role="alert">
          {records.at(-1)?.error}{" "}
          {recorder.blob
            ? "Retry transcription from the local recording or re-record."
            : "Record a new answer to retry."}
        </p>
      )}
      {original && !recorder.recording && !processing && (
        <div className="mt-5">
          <Field
            label="Review transcript"
            hint="Correct transcription errors before submitting. The original transcript is retained, and edits are labeled user-corrected."
          >
            <textarea
              rows={6}
              minLength={10}
              maxLength={2000}
              value={draft ?? original}
              disabled={busy}
              onChange={(e) => {
                setDraft(e.target.value);
                answerKey.current = crypto.randomUUID();
              }}
            />
          </Field>
          <Button
            className="mt-4"
            disabled={busy || (draft ?? original).trim().length < 10}
            onClick={() => void submit()}
          >
            {busy ? "Saving answer…" : "Submit answer & next question"}
          </Button>
        </div>
      )}
    </div>
  );
}
