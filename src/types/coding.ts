import type { codingConfig } from "@/config/coding";
export type CodingLanguage = (typeof codingConfig.languages)[number];
export type IntegrityEventType =
  "copy" | "paste" | "context-menu" | "tab-hidden" | "focus-lost";
export interface IntegrityEvent {
  id: string;
  type: IntegrityEventType;
  detail: string;
  timestamp: string;
}
export interface CodingEvaluation {
  dimensions: { label: string; feedback: string }[];
  suggestions: string[];
  notice: string;
}
export interface CodingRound {
  id: string;
  problemId: string;
  language: CodingLanguage;
  startedAt: string;
  durationMinutes: number;
  drafts: Record<CodingLanguage, string>;
  status: "active" | "submitted" | "ended";
  events: IntegrityEvent[];
  eventCount: number;
  followupAnswers: Record<string, string>;
  evaluation?: CodingEvaluation;
  completedAt?: string;
}
