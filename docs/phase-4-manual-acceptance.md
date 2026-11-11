# Phase 4 manual acceptance record

Last reviewed: 11 November 2026 (Asia/Kolkata). **This checklist is the original pending baseline; subsequent partial evidence is recorded in [follow-up acceptance](phase-4-followup-acceptance.md) and [physical results](physical-acceptance-results.jsonl).** This is an execution record for the original Phase 4 prompt, not a claim that the tests were performed. Automated results and setup instructions are in [Phase 4 acceptance](phase-4-acceptance.md).

Record each result as passed, failed, unavailable or intentionally unsupported. Preserve failures and limitations. Use synthetic/non-sensitive resume and answer content. Never attach credentials, verification/recovery tokens, private inbox contents, raw audio or camera images as evidence without separate authorization. Prefer sanitized request IDs, event metadata, status codes and descriptions.

## Test environment and consent

- Test date/time and timezone: pending.
- Tester reference (non-identifying), browser/version, OS/version: pending.
- Physical device, camera and microphone model/selection: pending.
- Application origin and deployed revision/reference: pending.
- Provider/model configuration and test scope: pending; record names only, not keys.
- Explicit consent for physical audio capture and transmission to Groq: provided in this chat on 11 November 2026.
- Explicit consent for local camera checks: provided by the tester on 11 November 2026; any additional visible person still needs their own consent.
- Separate optional consent for selected images being sent to Groq: provided by the tester on 11 November 2026; the app checkbox remains separate and off by default.
- Known environment conditions (lighting, distance, noise, bandwidth): pending.

Do not perform a recording or image-transmission test before its consent is recorded. Consent withdrawal must stop new image uploads; a sample already sent cannot be recalled. If hardware or a consenting tester is unavailable, leave the relevant checks unavailable/pending and use the automated evidence only for its stated scope.

## E — hosted email capacity and real-inbox delivery

- [ ] **E01: Inspect the matching hosted project.** Record whether an existing SMTP provider/Send Email Hook is configured, sender status, external-recipient restrictions and transactional activation. Preserve a suitable existing provider. Public Auth settings alone do not establish these facts.
- [ ] **E02: Verify actual capacity and budget.** Record provider plan, account-specific daily/hourly limits, reset semantics, any monthly limit, activation restrictions and remaining capacity. Establish at least 50 new registrations/day plus practical resend/recovery headroom. The proposed Brevo budget is 50 verification + 100 resend + 100 recovery + 50 spare sends/day, subject to the actual account settings. This is not a cutoff at 50 accounts.
- [ ] **E03: Check hosted enforcement and URLs.** Keep confirmation mandatory, confirm hosted email rate limits fit provider capacity, retain recipient/IP abuse controls and cooldowns, and verify exact Site URL/callback/recovery allowlist entries. Record actual values; application environment settings do not change hosted Auth limits.
- [ ] **E04: Limited confirmation/resend test.** With an authorized consenting inbox, register once, receive the email, check its approved destination and confirm sign-in. Resend once after cooldown and verify useful handling of an already-used or expired link. A mock response or admin-confirmed synthetic account does not prove this.
- [ ] **E05: Limited recovery test.** Request recovery for the authorized inbox, follow the approved URL and update the password. Check that reused/expired recovery links have clear recovery guidance. Compare unknown-account UI wording without sending mail to an unowned address.
- [ ] **E06: Capture delivery evidence and restrictions.** Record sanitized provider event status, delivery timing, actual inbox arrival and remaining restrictions. Distinguish SMTP acceptance from inbox receipt. Do not send 50 test emails, purchase a domain, enable billing or create paid services for this checklist.

Evidence/result notes: pending. Actual inbox delivery verified so far in Phase 4: **none**.

## H — original 11-step physical interview journey

- [x] **H01:** Sign in with an email-verified test account. Accepted using an admin-confirmed synthetic account; inbox confirmation is still pending under E04.
- [x] **H02:** Upload and analyze a non-sensitive real test PDF using the live backend/provider; record its saved resource reference without resume contents.
- [x] **H03:** Configure and create a video interview; confirm it reserves one interview slot.
- [x] **H04:** Select actual physical camera/microphone devices and pass the real checks. Record supported recording codec and local detector availability.
- [x] **H05:** Hear or read a generated question; verify speech synthesis stops before answer recording.
- [x] **H06:** After explicit audio consent, record a spoken answer through the physical microphone. Fake devices and generated speech do not satisfy this step.
- [x] **H07:** Send that answer through real Groq transcription. Record model and sanitized success/error metadata, not the audio.
- [x] **H08:** Review/correct the transcript and submit it; confirm the answer and correction state are saved.
- [x] **H09:** Continue through generated follow-ups and subsequent questions without additional interview-slot charges.
- [x] **H10:** Complete the interview and open the saved report; confirm observation events do not change answer-quality scores.
- [x] **H11:** Refresh and reopen the report in another signed-in browser session. Confirm another account cannot access the report.

Evidence/result notes: pending. The final guided run completed six audio uploads and six submitted answers, then verified a saved report after refresh and another browser context. Camera/microphone tracks ended and temporary data was cleaned up. See [raw physical evidence](physical-acceptance-results.jsonl). The earlier interrupted runs remain recorded, and E/A/O/B checks retain their separate pending scopes.

## A — adverse audio/device/network conditions

- [ ] **A01:** Silence is rejected or requires useful re-recording guidance rather than being accepted as invented speech.
- [ ] **A02:** Record a non-sensitive answer with background noise; review transcription errors and correction behavior. Record actual limitations rather than an accuracy claim.
- [ ] **A03:** Interrupt recording and disconnect the microphone. Verify useful feedback, stopped tracks and safe retry behavior.
- [ ] **A04:** Deny camera/microphone permission, then recover permissions and reselect devices. Unsupported configurations show guidance and do not silently switch to text mode.
- [ ] **A05:** Interrupt network/transcription processing using a controlled failure; confirm confirmed answers survive and retries do not duplicate answers or charge another interview slot. Avoid deliberately exhausting the real provider quota.
- [ ] **A06:** Background/return, refresh, complete and leave the room. Confirm playback/recording separation and cleanup of tracks, timers, detector workers and listeners; clearly disclose loss of an unsent in-memory recording.

Evidence/result notes: pending. Automated adapters cover selected conditions; these boxes require physical/device-specific evidence.

## O — camera observations and optional phone checks

- [ ] **O01:** Sustain face absence past the configured threshold and return for the recovery threshold; confirm bounded warnings and a matching saved episode/recovery timeline.
- [ ] **O02:** Show multiple consenting faces and return to one face. Record misses/false warnings with lighting, distance and occlusion conditions.
- [ ] **O03:** Disconnect/freeze/interrupt the camera or detector. Verify unavailable coverage rather than a fabricated no-face finding.
- [ ] **O04:** Hide/return to the tab and blur/refocus the window. Compare live activity and saved timeline; check coalescing/cooldowns avoid warning floods. Focus changes are observations, not proof of cheating.
- [ ] **O05:** Separately opt in to external phone-image sampling. Compare phone-visible and no-phone scenes, including small/occluded phones and similar-looking objects. Record local-filter and cloud-result limitations separately.
- [ ] **O06:** Withdraw optional image consent, including while a request is pending. Confirm no new image uploads, ignored late results and persisted withdrawal metadata.
- [ ] **O07:** Introduce a controlled optional-vision failure and submit an already-ready transcript. Answer submission must continue; the observation is unavailable rather than a phone finding.
- [ ] **O08:** Inspect network/storage and saved reports for expected metadata only: no full video recording, unexpected retained images or image retry queue. Record what was actually inspected; database backup/provider retention is a separate operator concern.

Evidence/result notes: pending. The earlier reference-image test's known local-filter miss on a folding phone remains historical evidence in [phone vision](phone-vision.md); it is not a physical-scene pass or an accuracy benchmark.

## B — browser, mobile and accessibility scope

- [ ] **B01: Desktop Chrome physical devices.** Complete H/A/O checks with browser/OS versions and codec/device details recorded.
- [ ] **B02: Firefox desktop.** Test permissions, recording/playback codecs, device selection, speech synthesis, MediaPipe/WASM and recovery/cleanup, or mark the configuration unavailable/unsupported with the actual guidance.
- [ ] **B03: Safari/macOS and Safari/iPhone/iPad.** Test each available configuration separately; a Chrome or mobile-width pass does not establish Safari/iOS support.
- [ ] **B04: Android Chrome physical device.** Test rotation/responsive controls, permission flow, background/return, physical audio/video and saved reports; identify the device/version.
- [ ] **B05: Low-performance or unsupported device.** Check detector initialization, recording support, useful failure guidance and absence of an unintended text fallback.
- [ ] **B06: Keyboard and accessibility audit.** Traverse setup/device/consent/record/playback/transcript/submit/complete controls without a pointer. Check focus visibility/order, accessible names, status/error announcements and screen-reader behavior with the actual assistive technology/version.
- [ ] **B07: Small screens and interrupted lifecycle.** Check viewport overflow, device selection, transcript editing, report navigation, refresh, network interruption and background/return on actual supported devices.

Evidence/result notes: pending. Current verified browser scope is desktop Chrome automation and mobile-width layout emulation only. Accept a browser/device combination from its recorded evidence; do not label all browsers supported from one engine's result.

## S — remaining real-model scoring evaluation

- [ ] **S01:** Re-evaluate repeated filler and transcription-error cases from `phase4-synthetic-v1` when provider capacity permits. Stop on throttling; use bounded calls and retain provider errors as unverified results.
- [ ] **S02:** Re-evaluate submitted filler after the wording refinement; confirm feedback says nonresponsive/off-topic rather than claiming a submitted answer was absent.
- [ ] **S03:** Review question/answer grounding, reasonable strong/partial/incorrect ordering and absence of personality/emotion/vocal-confidence inference. Deterministic arithmetic/evidence tests remain the regression contract; real-model wording/scores are variable evaluations.

Evidence/result notes: pending. Preserve [existing results and failures](phase-4-grading-results.jsonl); append new evidence rather than replacing inconvenient outcomes. An unanswered synthetic case is scored locally without a model call.

## Closure record

- Actual provider configuration/inbox delivery accepted by/date/evidence: pending.
- Consenting physical journey and adverse-condition checks accepted by/date/evidence: pending.
- Physical observations/privacy checks accepted by/date/evidence: pending.
- Accepted browser/device scope and explicit unsupported configurations: pending.
- Remaining scoring evaluation and known limitations accepted by/date/evidence: pending.
- Any failures, deferred checks and affected scope: pending.
- Overall Phase 4 acceptance: **open**. A service restart, a generated checklist or a passing automated adapter test does not close external/manual requirements.
