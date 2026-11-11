// Browser-only simulation; live eligibility always comes from PostgreSQL.
export const DEMO_INTERVIEW_LIMIT = 3;
export type DemoUsage = {
  startedAt: number | null;
  resumes: number;
  interviews: number;
};
export const emptyUsage: DemoUsage = {
  startedAt: null,
  resumes: 0,
  interviews: 0,
};
export function currentDemoUsage(
  usage: DemoUsage,
  now = Date.now(),
): DemoUsage {
  return usage.startedAt !== null && now >= usage.startedAt + 86400000
    ? emptyUsage
    : usage;
}
export function interviewAllowance(createdSessions: number) {
  return {
    limit: 3,
    used: createdSessions,
    remaining: Math.max(0, 3 - createdSessions),
    canStart: createdSessions < 3,
  };
}
