# Interview scoring

New reports use `transcript-v2`. The AI assigns three marks per confirmed answer:
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
