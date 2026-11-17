"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { z } from "zod";
import { sessionSchema, resumeSchema, summarySchema } from "@/lib/validation";
import {
  interviewAllowance,
  currentDemoUsage,
  emptyUsage,
  type DemoUsage,
} from "@/config/usage";
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
  usage: DemoUsage;
  authenticated: boolean;
  profile: Profile;
  preferences: Preferences;
  sessions: InterviewSession[];
  resumes: ResumeRecord[];
  history: InterviewSummary[];
  beginInterview: (session: InterviewSession) => boolean;
  login: (profile: Profile) => void;
  logout: () => void;
  saveProfile: (profile: Profile) => void;
  savePreferences: (preferences: Preferences) => void;
  saveSession: (session: InterviewSession) => void;
  addResume: (resume: ResumeRecord) => boolean;
  reset: () => void;
}
const initial = {
  usage: emptyUsage,
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
      beginInterview: (session) => {
        const state = get();
        const usage = currentDemoUsage(state.usage);
        if (state.sessions.some((s) => s.id === session.id)) return true;
        if (!interviewAllowance(usage.interviews).canStart) return false;
        set({
          sessions: [session, ...state.sessions],
          usage: {
            ...usage,
            startedAt: usage.startedAt ?? Date.now(),
            interviews: usage.interviews + 1,
          },
        });
        return true;
      },
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
      addResume: (resume) => {
        const state = get(),
          usage = currentDemoUsage(state.usage);
        if (state.resumes.some((r) => r.id === resume.id)) return true;
        if (usage.resumes >= 10) return false;
        set({
          resumes: [resume, ...state.resumes],
          usage: {
            ...usage,
            startedAt: usage.startedAt ?? Date.now(),
            resumes: usage.resumes + 1,
          },
        });
        return true;
      },
      reset: () => set(initial),
    }),
    {
      name: "mockmate-demo-v1",
      version: 1,
      storage: createJSONStorage(() => demoStorage),
      skipHydration: true,
      partialize: ({
        usage,
        authenticated,
        profile,
        preferences,
        sessions,
        resumes,
        history,
      }) => ({
        usage,
        authenticated,
        profile,
        preferences,
        sessions,
        resumes,
        history,
      }),
      onRehydrateStorage: () => (state) => {
        // Rewrite old saves with the validated retained fields, even before an edit.
        if (state) state.savePreferences(state.preferences);
      },
      merge: (persisted, current) => {
        // A corrupt or outdated browser value must never crash the application.
        const parsed = z
          .object({
            usage: z
              .object({
                startedAt: z.number().nullable(),
                resumes: z.number().int().nonnegative(),
                interviews: z.number().int().nonnegative(),
              })
              .catch(emptyUsage),
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
            // Zod strips retired properties while preserving existing records.
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
