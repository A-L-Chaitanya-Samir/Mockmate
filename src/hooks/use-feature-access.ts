"use client";
import { useDemoStore } from "@/stores/demo-store";
import {
  plans,
  hasFeature,
  interviewAllowance,
  type Feature,
} from "@/config/plans";
export function useFeatureAccess() {
  const plan = useDemoStore((s) => s.plan);
  const sessionCount = useDemoStore((s) => s.sessions.length);
  return {
    plan,
    definition: plans[plan],
    can: (feature: Feature) => hasFeature(plan, feature),
    interviews: interviewAllowance(plan, sessionCount),
  };
}
