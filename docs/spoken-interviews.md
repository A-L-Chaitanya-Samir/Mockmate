# Camera-on spoken interview practice

This phase supersedes older text-first roadmaps. New live sessions use `mode=Spoken`; historical `Text` sessions and reports remain valid. The separate opt-in demo remains explicitly simulated. Coding interviews, subscriptions, payments and Pro remain removed.

## User flow and privacy

Configure the role, type, difficulty, duration and optional resume. The interview room first checks camera, microphone, supported MediaRecorder format and a local MediaPipe detector. Select devices, enable them, record and listen to a disposable audio test, then acknowledge external transcription and local observations. The deadline begins after both device checks and generated questions are ready. Refresh requires new local device checks without resetting the server deadline.

Questions remain visible and may optionally play through browser speech synthesis. Playback stops before audio-only recording starts. Record at most 120 seconds / 8 MB. Stopping the recording automatically queues transcription. Review the transcript, correct errors if needed, then select “Submit answer & next question”. Local audio playback remains optional. Saved answers advance the room immediately; delayed contextual AI feedback does not block the next spoken answer. The original transcription, configured model, question/session/user association, modality and correction flag are preserved. Submitted answers and ready transcriptions survive refresh; in-progress recordings are memory-only and may be lost. No video, screenshot, face identity, embedding, or full interview recording is retained by Mockmate. Optional AI phone-visibility checks can send separately consented samples to Groq; see [phone visibility](phone-vision.md).

Answer audio goes through the authenticated FastAPI backend to Groq. Face-detection video frames stay in the browser and are sampled at most every 750 ms by default, resized and transferred to a worker for MediaPipe inference. The model, JS and WASM are served from the app's origin. Face presence and multiple faces are supported locally. Optional phone visibility uses a local object filter plus Groq confirmation with separate image consent. Identity, emotion, gaze, phone-use and external-help claims are not supported.

## Architecture and schema

Apply `20261110105614_spoken_interviews.sql` after the existing migrations, with API/worker stopped, then restart both. Do not rewrite historical migrations. New tables have RLS enabled and no browser-role grants; all access is through the authenticated backend. A composite foreign key binds each transcription to its owner's session and question. Sessions retain versioned observation configuration, device-check metadata, and a frozen integrity snapshot. Legacy answer rows default to `modality=text`.

`POST /interviews/{id}/transcriptions` validates ownership/current turn, type, bytes, decoded duration and an energy floor using pinned PyAV. Only normalized mono WAV leaves the server. Quiet audio is rejected before provider calls, and verbose provider output with no reliable speech is rejected. Energy and no-speech probabilities are imperfect speech filters; transcript confirmation is required. Uploads and answer submission use separate idempotency keys. Up to 24 recordings per session are allowed. No paid provider fallback or fixture fallback exists.

Transcription uses the existing leased, fenced durable worker. Normalized temporary audio lives in the backend-only `transcriptions.audio_bytes`, never in job payloads. Success and terminal failure remove bytes; completion cancels pending transcription jobs and clears bytes. Abandoned/interrupted jobs have a one-hour expiry, swept before each worker claim. Automatic retry backoff retains bytes within that TTL. Retry exhaustion requires re-recording. Run at least one worker continuously for expiry cleanup; if all workers are down, cleanup resumes when one restarts. Database backups may retain earlier byte pages according to the database operator's retention policy.

The worker also completes expired server deadlines and evaluates actual questions and confirmed answers. Performance feedback uses the existing correctness/relevance, reasoning/evidence and text clarity/structure rubric; no vocal confidence, body language, speaking quality or audio delivery is inferred.

## Observations and reports

Default face thresholds: 4 seconds sustained, 2 seconds recovery, 10 seconds cooldown. Tab visibility transitions are recorded immediately without waiting for background timers. Window-focus and device changes use a 1-second debounce. A persistent live activity list and per-visit tab-switch count remain visible after returning to the interview. Hidden-tab and focus-loss signals are coalesced to avoid counting a tab switch twice. Hidden/stalled/detector-unavailable intervals are not labeled no-face. Facial episode durations crossing an unobserved interval are left unmeasured. Device interruptions, detection availability and collection gaps are disclosed.

Ingestion validates ownership, spoken-session lifecycle, typed bounded batches (25), timezone-bearing client times and duration bounds. API authentication has a shared 120-request/minute account cap; event ingestion additionally caps 120 events/minute and 2,000/session. UUID event IDs and episode/phase uniqueness suppress retries. Client times and measurements remain unverified even alongside server receipt times.

The browser stores at most 150 unsent metadata events in tab-scoped session storage, retries every five seconds, and reports dropped or unsent events as collection gaps. Audio is never stored there. Completion attempts a bounded flush before freezing the observation snapshot; late retries cannot change a completed report. If the server deadline completes first, the snapshot reports an interrupted collection and cannot recover unreceived client events. Coverage is a bounded client-measured estimate of visible, detector-ready sample intervals, not a verified coverage guarantee.

Reports show interview performance and a separate deterministic observation timeline with episode counts, recoveries, measured durations where available, coverage and interruptions. Events never enter the LLM evaluation context or affect the answer-quality score. Browser observations can be incomplete or tampered with and do not prove cheating. Existing account history, analytics, suggestions and JSON exports consume the same saved session/report objects.

## Configuration and assets

Install backend requirements (adds `av==16.1.0`) and run `npm ci`. `predev`/`prebuild` run `scripts/prepare-media.mjs`, copying the pinned `@mediapipe/tasks-vision@0.10.32` runtime and checking the committed version-1 BlazeFace model SHA-256. See `public/mediapipe/NOTICE.md` and `LICENSE` for Apache-2.0 attribution. No runtime CDN dependency is needed.

`TRANSCRIPTION_PROVIDER=groq`, `TRANSCRIPTION_MODEL=whisper-large-v3-turbo`, `MAX_AUDIO_BYTES`, `MAX_AUDIO_SECONDS` (hard maximum 120), `AUDIO_MIN_RMS`, `FACE_MODEL_PATH` (an app-local asset), `FACE_MIN_CONFIDENCE`, and `OBSERVATION_*` configure the backend. Language model choice remains `GROQ_MODEL`. Speech requires the configured account to permit its selected model. No credentials belong in public frontend variables except Supabase's publishable key.

Official Groq docs checked 10 November 2026 list turbo speech support, a 25 MB free upload limit and nominal free limits of 20 RPM, 2,000 RPD, 7,200 audio seconds/hour and 28,800/day. Exact organization limits can differ; check the account's limits page. Mockmate deliberately imposes smaller upload/duration limits and surfaces quota errors with bounded retries. Sources: [speech](https://console.groq.com/docs/speech-to-text), [limits](https://console.groq.com/docs/rate-limits), [MediaPipe Face Detector](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector?tab=Web).

## Verification boundaries

`backend/tests/test_spoken.py` exercises real local decoding with generated waveforms and deterministic provider adapters: invalid types/data/size/duration, silence, credential/quota errors, durable transcription, idempotency, corrections, ownership, snapshots, terminal cleanup, expiry and server deadlines. Existing backend tests cover legacy text sessions/reports and account isolation. `tests/spoken.spec.ts` tests episode thresholds and real bundled MediaPipe inference on a blank synthetic frame, plus permission/detector/format failures. `tests/live.spec.ts` records via Chrome fake devices and uses an explicitly deterministic speech adapter for the authenticated saved-report journey. These do not establish physical-camera or physical-microphone acceptance.

For real Groq acceptance only, supply a synthetic speech WAV to `backend/.venv/Scripts/python.exe scripts/speech-smoke.py path/to/sample.wav`; the included checker expects the words authentication, ownership and transactions. Run actual camera/microphone practice in a supported secure-context browser separately. Browser speech voices, device selection, hardware permissions, recording codecs, worker/WASM support and operating-system interruptions vary; unsupported configurations block with retry guidance instead of silently switching session mode.

## Acceptance record — 10 November 2026

The development Supabase database has both the single-free-experience and spoken-interview migrations applied and recorded. Retained resource row counts were unchanged, public-table RLS was verified, and both new tables deny anon/authenticated grants. The connected Supabase plugin targets a different project, so the existing configured development connection was used; a hosted advisor scan was unavailable through that CLI account. Direct RLS/grant checks and isolated migration tests passed.

A real Groq turbo transcription accepted 8.2 seconds of locally generated synthetic speech. A full real Auth/Storage/Postgres/Groq acceptance run passed 36 checks, including generated questions, durable transcription, original/confirmed answer provenance, contextual response, final report, cross-account rejection, refresh, and temporary audio removal. Both temporary synthetic accounts and their data were cleaned up. Device acknowledgements in that run were explicitly test metadata; it does not verify a physical camera or microphone.

Backend regression: 47 passed, one native-PostgreSQL concurrency test skipped in the PGlite harness. Live Chrome regression: 12 passed using fake devices and deterministic speech/detector adapters where labeled, including real MediaPipe inference on a blank synthetic frame, permissions/detector/format failures, network retries, hidden-tab/focus coalescing, playback exclusion, media cleanup, report refresh, responsive screens and account isolation. TypeScript, ESLint, migration preservation and production build passed. A separate Chrome run without fake-device flags exposed two camera inputs and three microphone inputs, opened live camera/microphone tracks, and ran the real local MediaPipe model on five device frames; tracks were stopped afterward. Real spoken-microphone-to-Groq acceptance and browser-specific Safari/Firefox codec/permission behavior remain manual checks.

The separate `node scripts/hardware-smoke.mjs` check uses OS devices without fake-media flags and does not record or upload microphone audio. Demo/product browser regressions also passed all 14 checks.

## Answer progression and tab-visibility fixes

A recording alone is not a saved answer. The room now automatically starts transcription when recording stops and labels the confirmation action “Submit answer & next question”. Successful save responses update the current session immediately, without waiting for a workspace refresh or an AI acknowledgment. Spoken turn ordering remains enforced; optional contextual feedback runs in the background. Camera/detector interruptions no longer prevent submission of an already transcribed answer.

Visibility-change events synchronously create and close tab episodes, including short switches and browser-suspended intervals. Frame-based observations retain their sustained thresholds. Live observations show supported checks explicitly; face detection does not detect phones or establish phone use.

Fix verification: 48 backend tests passed (one native PostgreSQL concurrency test skipped), and all 14 live Chrome tests passed. The progression regression keeps response jobs pending while advancing to question 2. The real-tab test connects to a separate Chrome default context with `noDefaults: true` because ordinary Playwright pages force focus/visibility; it checks an actual hidden/visible transition without overriding document properties. Lint, TypeScript and the production build passed.

## Optional phone visibility

See [phone-vision.md](phone-vision.md) for the separately consented Groq image integration, local object filter, sampling budgets, no-image-retention policy, validation evidence and limitations. This supersedes the earlier statement that all phone visibility was unsupported. Phone use and cheating are never inferred.
