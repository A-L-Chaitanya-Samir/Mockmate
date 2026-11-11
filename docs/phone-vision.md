# Optional AI phone-visibility checks

Phone visibility is an optional addition to spoken practice. The existing Groq server key is reused with configurable `VISION_MODEL=qwen/qwen3.8-27b`. No new key, paid plan, subscription, payment flow or agent service is required. This implementation uses a small coordinator rather than an extra agent framework.

## Enable and stop

At the device check, select **Enable optional AI phone-visibility checks** and review the separate image-processing disclosure. The default is off, including after refresh. A successful standard device check records this image consent, its version and server receipt time. During the interview, **Turn off image checks** stops new browser uploads immediately and records consent withdrawal on the backend. A frame already sent to the provider cannot be recalled; its result is ignored if consent is withdrawn before it completes. Face, tab and spoken-answer checks remain separate.

Face frames stay local. If this option is enabled, selected camera images are sent through the authenticated backend to Groq. Mockmate does not store the images, screenshots, full recordings, facial identity or embeddings. Groq handles submitted images under its own data policies. Only check metadata, model, result, timestamps, consent and warning episode IDs are persisted. A SHA-256 request fingerprint supports idempotency and is not used for identity.

## Efficient sampling

A pinned, locally hosted **EfficientDet-Lite0 INT8 v1** runs in the existing MediaPipe worker at most once every two seconds, restricted to the `cell phone` class. It is a candidate filter, not the final AI observation. The model asset is 4.6 MB and its SHA-256 is checked by `prepare-media.mjs`; the existing MediaPipe Apache-2.0 license applies.

Cloud confirmation is eligible at most every 20 seconds for phone candidates, requested samples, or follow-up of an AI-positive result. Without a candidate, routine audit samples run about once per minute. Audits are important because the small local model can miss objects. Checks pause while the tab is hidden, the camera is interrupted/frozen, consent is off, or a request is in progress. No image retry queue is persisted. Each JPEG is downscaled to at most 640 pixels per side, capped at 128 KB, decoded and re-encoded server-side to validate it and strip metadata.

Server-wide limits reserve capacity transactionally across users: at most three attempts per rolling minute, 80 per rolling 24 hours, and 180 per session. These hard ceilings can be lowered with `VISION_MAX_PER_MINUTE`, `VISION_MAX_PER_DAY` and `VISION_MAX_PER_SESSION`. `VISION_INTERVAL_SECONDS` and `VISION_AUDIT_SECONDS` can increase the intervals. Current Groq docs list 2,048 input tokens per image and nominal Qwen limits of 8,000 tokens/minute and 200,000/day; the local ceilings leave prompt/output headroom but cannot account for usage of the same key outside Mockmate. Real provider 429 responses set a shared cooldown. No paid or fixture fallback is enabled.

Vision calls have a 12-second provider timeout and remain within a normal request lifecycle. They are independent of interview generation, transcription and answer progression. Provider failures, invalid output, uncertain images and capacity pauses are shown as unavailable/uncertain, never converted into a phone finding.

## Warnings and reports

The provider can return only `visible`, `not_visible` or `uncertain`. Two consecutive successful phone-visible samples are required for a warning episode. Uncertain or failed checks break the positive streak. A later phone-negative sample closes the episode. These sampled observations do not measure continuous phone-visible duration, actual phone use, outside help or cheating, and do not affect interview performance scores.

The saved integrity section includes check counts, uncertain/unavailable intervals and a deterministic sampled timeline. Images are unverified client-supplied input, even though the inference runs server-side. Completion freezes this summary and cancels pending metadata checks; late results cannot alter a completed report. The model is instructed to ignore text/instructions in images and not identify people or infer gaze, emotion, intent or misconduct.

## Database and contracts

Apply `20261110142131_optional_phone_vision.sql` after the earlier migrations, then restart API and worker. It adds `interview_sessions.vision_state`, backend-only `interview_vision_checks` metadata and a singleton shared capacity/cooldown row. Both new tables have RLS enabled and no anon/authenticated grants. Composite session/user foreign keys, authenticated ownership checks, lifecycle validation and idempotency keys protect ingestion. No image bytes column, image storage bucket, new service, or rewritten historical migration is introduced. OpenAPI and generated frontend types include consent, state and report schemas.

## Validation and limits

Real Groq calls correctly returned `visible` for COCO validation images **446207** (folding phone beside a camera) and **53909** (smartphone held in a hand), and `not_visible` for **39769** (cats with remote controls). The real local filter detected the smartphone and rejected the remote controls, but missed the folding phone. These three cases are limited acceptance checks, not a calibrated accuracy benchmark. Small, occluded, unusual or briefly shown phones can be missed; wallets, remotes and screen images can cause ambiguity.

Reference photos were downloaded only into ignored temporary test files, not distributed with the application. Sources: [COCO](https://cocodataset.org/#download), [446207 Flickr source](https://www.flickr.com/photo.gne?id=3160251864) (CC BY), [53909 Flickr source](https://www.flickr.com/photo.gne?id=8714966583) and [39769 Flickr source](https://www.flickr.com/photo.gne?id=210383891) (CC BY-SA), with labels/licenses from the COCO validation annotation metadata. No personal camera images were uploaded during these real-provider checks.

`backend/tests/test_vision.py` checks consent, ownership, JPEG validation, idempotency, repeated findings, shared quotas, failures, RLS, withdrawal and late-result fencing. `tests/vision.spec.ts` uses an explicit deterministic adapter to test opt-in, two-sample warnings, withdrawal and saved reports. Real reference checks can be repeated with `scripts/vision-smoke.py --case visible path/to/phone.jpg --case not_visible path/to/negative.jpg`. `node scripts/hardware-smoke.mjs path/to/phone.jpg path/to/negative.jpg` tests the real local object model on supplied files.

Official references: [Groq vision](https://console.groq.com/docs/vision), [Qwen model](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [rate limits](https://console.groq.com/docs/rate-limits), [MediaPipe Object Detector](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector?tab=Web).

## Verification record — 10 November 2026

57 backend checks passed, with the native PostgreSQL concurrency case skipped in the PGlite harness. All 15 live Chrome browser checks passed, including opt-in, repeated phone warnings, consent withdrawal, report persistence, spoken-answer progression and real tab switching. TypeScript, ESLint, migration preservation, production build and secret checks passed. The migration was applied to the configured development Supabase project with retained row counts unchanged and new-table RLS/grants verified. The restarted live frontend and API/worker returned ready responses. Real-provider validation used the three public reference images above; a person holding a phone in their own webcam scene remains a manual acceptance check after opting in. No new credentials or paid-service setup was required.
