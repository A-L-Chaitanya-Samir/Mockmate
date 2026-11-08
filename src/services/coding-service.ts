import { codingConfig } from "@/config/coding";
import { codingProblems, sampleCodingEvaluation } from "@/data/coding-data";
import { mockRequest } from "./api-client";
import type {
  CodingLanguage,
  CodingRound,
  CodingEvaluation,
  IntegrityEvent,
  IntegrityEventType,
} from "@/types/coding";
export const codingService = {
  create: (problemId: string, language: CodingLanguage): Promise<CodingRound> =>
    mockRequest(() => {
      const problem = codingProblems.find((p) => p.id === problemId);
      if (!problem)
        throw new Error(
          "This demo problem is unavailable. Choose another question set.",
        );
      return {
        id: `coding-${crypto.randomUUID()}`,
        problemId,
        language,
        startedAt: new Date().toISOString(),
        durationMinutes: codingConfig.durationMinutes,
        drafts: { ...problem.starters },
        status: "active",
        events: [],
        eventCount: 0,
        followupAnswers: {},
      };
    }),
  run: (): Promise<string> =>
    mockRequest(
      () =>
        "SIMULATED RUN — no code was executed.\n\nThe Test cases tab lists fixed expected examples.\nThey are not pass/fail results for your submission.",
      700,
    ),
  evaluate: (): Promise<CodingEvaluation> =>
    mockRequest(() => sampleCodingEvaluation, 900),
};
/** Client event DTO only. Phase 2 needs an authenticated, trusted backend event sink. */
export function createIntegrityEvent(
  type: IntegrityEventType,
  detail: string,
): IntegrityEvent {
  return {
    id: crypto.randomUUID(),
    type,
    detail,
    timestamp: new Date().toISOString(),
  };
}
