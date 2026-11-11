# Interview scoring

New reports use `transcript-v4-isolated` with prompt version `interview-grading-v4`. Historical v3, v2 and older reports retain their stored scores. The AI assigns three marks per confirmed answer:
correctness/relevance (40%), reasoning/evidence (35%), and text clarity/structure (25%).
The server calculates each question's weighted mark, then averages the published
question marks for the overall score. Rounding uses nearest integer, halves up.
Every question, including generated follow-ups, counts equally. Unanswered questions
receive zero in every criterion and remain in the denominator. The report shows coverage.

The rubric anchors 0 as no assessable content, 1–19 as essentially no substance or
fundamentally wrong, 20–39 as fragments with major gaps, 40–59 as partial,
60–74 as mostly correct with meaningful omissions, 75–89 as sufficient and sound,
and 90–100 as precise and complete for the actual question and difficulty.
Generic filler and fluent factual errors do not demonstrate technical knowledge.
Concise correct explanations can earn full credit; length, accent, camera behavior,
tab observations, and confidence do not determine answer marks.

Positive marks require a quote verified against the actual confirmed answer.
Unknown, missing, or duplicate question IDs and invented quotes fail validation and
use the existing job retry flow. An entirely unanswered session is scored directly
without spending an AI call. Historical reports retain their original rubric and scores.

Run `backend/.venv/Scripts/python.exe scripts/grading-smoke.py` for synthetic
real-provider controls. The controls check filler, incorrect facts, concise accurate
explanations, and unanswered questions. They are a regression check, not evidence of
validated hiring fairness across roles or demographic groups. Scores remain AI coaching
judgments; model variability and transcript quality can affect them.


Phase 4 adds the versioned `phase4-synthetic-v1` cases for partial, off-topic, repeated filler and transcription-error answers. See [acceptance results and limitations](phase-4-acceptance.md) and [raw safe model results](phase-4-grading-results.jsonl). Observation metadata is explicitly removed before model grading. Provider throttling leaves affected evaluations unverified.


## Rigorous question and grading policy

`interview-depth-v1` calibrates four distinct questions and targeted follow-ups to role, explicit seniority, interview type, difficulty and optional resume claims. Easy probes fundamentals/application; Medium adds an applied decision and requested trade-off/failure verification; Hard adds constrained alternatives and failure analysis relative to seniority. Essential assessed aspects must be asked, not introduced after answering. Question/follow-up job metadata records the policy version. New session configuration defaults seniority to Mid-level; no historical session/report is rewritten.

The v3 prompt requires substantive deductions for factual errors, contradictions and missing requested mechanisms, while preserving concise correct answers and valid alternatives. No score ceiling, blanket reduction or forced failure rate exists. Configuration sent to grading is allowlisted to role/seniority/type/difficulty/language; media/observation configuration is excluded. Submitted nonresponsive text is distinguished from unanswered questions. Arithmetic and zero handling remain unchanged.

[Versioned calibration anchors](../backend/app/ai/calibration-v2.json) contain the actual scenario, essential expectations and nine answer categories. Authored marks are test anchors, not model results. The [follow-up acceptance record](phase-4-followup-acceptance.md#real-model-scoring-evaluation) documents real-model scores, rejected evidence and known attribution/wording limitations. This is demanding coaching, not a claim of equivalence to every employer or a hiring decision.


## Isolated answer grounding (v4)

Each answered question now gets its own provider request containing only its confirmed answer, actual prompt/topic and allowlisted role/seniority/type/difficulty/language. Other answers, original unconfirmed transcripts, observation configuration and integrity metadata are absent. This removes the multi-answer context that allowed v3 feedback to attribute another answer's wording to the current question. The complete report is assembled on the server without a second model summarization call. Summary bullets name their question and are interleaved within the existing eight-item limit.

The server validates the exact single question ID, evidence against its own answer, and double-quoted text in feedback/summary lists against that same answer (with the existing typography/whitespace normalization). Unsupported quotes reject the evaluation into the existing retry path; they are not silently presented. Unanswered questions require no provider call. Weighting, half-up rounding, denominator/coverage and full-credit eligibility are unchanged. This does not prove every unquoted claim or deduction is correct.

At most six sequential answer-grading calls replace the former single evaluation call. A full six-answer session can now use thirteen logical text-generation calls (one generation, six responses, six grades), plus transcription/optional image calls and bounded failure retries. Evaluation leases are at least 360 seconds; other leases remain configured at 180 seconds by default. Lease tokens and single-report uniqueness still fence late writers. A retry can repeat already assessed answers because partial evaluations are not stored; monitor provider budgets and latency. A failed result never rewrites a historical report.

[Current evidence and known calibration limitations](phase-4-quality-closure.md) include actual provider-format rejections and strong-answer variability. These are not exact score regression targets or hiring-grade accuracy estimates.
