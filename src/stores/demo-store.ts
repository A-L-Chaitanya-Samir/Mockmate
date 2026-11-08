"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { z } from "zod";
import {
  sessionSchema,
  resumeSchema,
  summarySchema,
  codingRoundSchema,
} from "@/lib/validation";
import { hasFeature, interviewAllowance, type PlanId } from "@/config/plans";
import { codingConfig } from "@/config/coding";
import type { CodingRound, IntegrityEvent } from "@/types/coding";
import { demoStorage } from "@/lib/demo-storage";
import { seedHistory } from "@/data/mock-data";
import type {
  InterviewSession,
  Profile,
  Preferences,
  ResumeRecord,
  InterviewSummary,
} from "@/types";
interface DemoState {
  authenticated: boolean;
  profile: Profile;
  preferences: Preferences;
  sessions: InterviewSession[];
  resumes: ResumeRecord[];
  history: InterviewSummary[];
  plan: PlanId;
  codingRounds: CodingRound[];
  setPlan: (plan: PlanId) => void;
  beginInterview: (session: InterviewSession) => boolean;
  saveCodingRound: (round: CodingRound) => void;
  recordIntegrityEvent: (roundId: string, event: IntegrityEvent) => void;
  login: (profile: Profile) => void;
  logout: () => void;
  saveProfile: (profile: Profile) => void;
  savePreferences: (preferences: Preferences) => void;
  saveSession: (session: InterviewSession) => void;
  addResume: (resume: ResumeRecord) => void;
  reset: () => void;
}
const initial = {
  authenticated: false,
  profile: {
    name: "Alex Morgan",
    role: "Aspiring Software Engineer",
    bio: "Building, learning, and preparing for what’s next.",
  },
  preferences: {
    notifications: true,
    reminders: true,
    defaultType: "Technical" as const,
    defaultMode: "Text" as const,
  },
  sessions: [],
  resumes: [],
  history: seedHistory,
  plan: "free" as PlanId,
  codingRounds: [],
};
// Persist only demo profile/preferences and text practice data. Never passwords or media.
export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      ...initial,
      login: (profile) => set({ authenticated: true, profile }),
      logout: () => set({ authenticated: false }),
      saveProfile: (profile) => set({ profile }),
      savePreferences: (preferences) => set({ preferences }),
      setPlan: (plan) => set({ plan }),
      beginInterview: (session) => {
        const state = get();
        if (!interviewAllowance(state.plan, state.sessions.length).canStart)
          return false;
        set({ sessions: [session, ...state.sessions] });
        return true;
      },
      saveCodingRound: (round) =>
        set((state) =>
          hasFeature(state.plan, "codingRounds")
            ? {
                codingRounds: [
                  round,
                  ...state.codingRounds.filter((r) => r.id !== round.id),
                ],
              }
            : state,
        ),
      recordIntegrityEvent: (roundId, event) =>
        set((state) => ({
          codingRounds: state.codingRounds.map((round) =>
            round.id === roundId && round.status === "active"
              ? {
                  ...round,
                  eventCount: round.eventCount + 1,
                  events: [...round.events, event].slice(
                    -codingConfig.maxStoredEvents,
                  ),
                }
              : round,
          ),
        })),
      saveSession: (session) =>
        set((state) => ({
          sessions: [
            session,
            ...state.sessions.filter((s) => s.id !== session.id),
          ],
          history:
            session.status === "completed"
              ? [
                  {
                    id: session.id,
                    role: session.config.role,
                    type: session.config.type,
                    date: session.createdAt,
                    score: 87,
                    duration: Math.max(1, Math.round(session.elapsed / 60)),
                  },
                  ...state.history.filter((s) => s.id !== session.id),
                ]
              : state.history,
        })),
      addResume: (resume) =>
        set((state) => ({ resumes: [resume, ...state.resumes] })),
      reset: () => set(initial),
    }),
    {
      name: "mockmate-demo-v1",
      version: 1,
      storage: createJSONStorage(() => demoStorage),
      skipHydration: true,
      merge: (persisted, current) => {
        // A corrupt or outdated browser value must never crash the application.
        const parsed = z
          .object({
            authenticated: z.boolean(),
            profile: z.object({
              name: z.string(),
              role: z.string(),
              bio: z.string(),
            }),
            preferences: z.object({
              notifications: z.boolean(),
              reminders: z.boolean(),
              defaultType: z.enum(["Technical", "HR", "Behavioral", "Mixed"]),
              defaultMode: z.enum(["Text", "Voice", "Video"]),
            }),
            // Additive migration: preserve existing v1 profiles and interviews.
            // Zod strips the retired learning-progress property from old saves.
            plan: z.enum(["free", "pro"]).catch("free"),
            codingRounds: z.array(codingRoundSchema).catch([]),
            sessions: z.array(sessionSchema).catch([]),
            resumes: z.array(resumeSchema).catch([]),
            history: z.array(summarySchema).catch(seedHistory),
          })
          .safeParse(persisted);
        if (!parsed.success) return current;
        return { ...current, ...parsed.data };
      },
    },
  ),
);
