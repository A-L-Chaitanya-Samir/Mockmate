export type PlanId = "free" | "pro";
export type Feature = "codingRounds" | "advancedResume" | "detailedFeedback";
interface PlanDefinition {
  name: string;
  price: string;
  description: string;
  recommended: boolean;
  capabilities: Record<Feature, boolean>;
  limits: { interviews: number };
  benefits: string[];
}
// Demo quotas are lifetime counts in this browser, not a billing period.
export const plans: Record<PlanId, PlanDefinition> = {
  free: {
    name: "Free",
    price: "₹0",
    description: "Build a strong foundation for your next opportunity.",
    recommended: false,
    capabilities: {
      codingRounds: false,
      advancedResume: false,
      detailedFeedback: false,
    },
    limits: { interviews: 3 },
    benefits: [
      "Basic resume analysis and score",
      "Basic resume improvement suggestions",
      "Limited AI interview practice",
      "Basic reports and feedback",
      "Personalized suggestions",
      "Main dashboard access",
    ],
  },
  pro: {
    name: "Mockmate Pro",
    price: "₹299",
    description: "Prepare for serious technical interviews with coding rounds.",
    recommended: true,
    capabilities: {
      codingRounds: true,
      advancedResume: true,
      detailedFeedback: true,
    },
    limits: { interviews: 20 },
    benefits: [
      "Everything in Free",
      "Full AI coding-round platform",
      "AI-generated coding questions (mock in Phase 1)",
      "Technical coding interview simulations",
      "Problem-solving editor and language selection",
      "Code submission and simulated evaluation",
      "More interview practice and detailed feedback",
      "Advanced resume recommendations",
    ],
  },
};
export const planOrder: PlanId[] = ["free", "pro"];
export function hasFeature(plan: PlanId, feature: Feature) {
  return plans[plan].capabilities[feature];
}
export function interviewAllowance(plan: PlanId, createdSessions: number) {
  const limit = plans[plan].limits.interviews;
  return {
    limit,
    used: createdSessions,
    remaining: Math.max(0, limit - createdSessions),
    canStart: createdSessions < limit,
  };
}
export const planComparison = [
  {
    label: "Resume analysis",
    free: "Basic analysis & score",
    pro: "Basic analysis & score",
  },
  {
    label: "Resume recommendations",
    free: "Basic improvements",
    pro: "Advanced recommendations",
  },
  {
    label: "AI interview practice",
    free: `${plans.free.limits.interviews} demo sessions`,
    pro: `${plans.pro.limits.interviews} demo sessions`,
  },
  { label: "Interview reports", free: "Basic report", pro: "Detailed report" },
  {
    label: "Personalized suggestions",
    free: "Included",
    pro: "Included, with coding insights",
  },
  {
    label: "Coding rounds",
    free: "Pro exclusive",
    pro: "Full coding interview workflow",
    coding: true,
  },
  {
    label: "Coding problem evaluation",
    free: "Pro exclusive",
    pro: "Simulated evaluation & follow-ups",
    coding: true,
  },
  {
    label: "Advanced feedback",
    free: "Basic feedback",
    pro: "Technical, communication & coding",
  },
];
