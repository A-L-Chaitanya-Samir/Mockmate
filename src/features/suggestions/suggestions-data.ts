import { mockReport, mockResume } from "@/data/mock-data";
import type { ResumeRecord, InterviewSummary } from "@/types";
import type { CodingRound } from "@/types/coding";
export interface Suggestion {
  id: string;
  category: "Resume" | "Interviews" | "Communication" | "Technical" | "Coding";
  title: string;
  detail: string;
  source: string;
  href: string;
  action: string;
}
/** Local mock synthesis: sources and selection are transparent, not real AI analysis. */
export function buildSuggestions(
  resumes: ResumeRecord[],
  history: InterviewSummary[],
  rounds: CodingRound[],
  includeCoding: boolean,
): Suggestion[] {
  const resume = resumes[0]?.analysis ?? mockResume;
  const latest = history[0];
  const items: Suggestion[] = [
    {
      id: "resume-impact",
      category: "Resume",
      title: "Make your project impact visible",
      detail:
        resume.improvements[0] ??
        "Add verified project outcomes to your resume.",
      source: resumes.length
        ? `Latest demo analysis · ${resumes[0].name}`
        : "Sample resume analysis",
      href: "/dashboard/resume",
      action: "Review resume suggestions",
    },
    {
      id: "interview-structure",
      category: "Interviews",
      title: latest
        ? `Reflect on your ${latest.type.toLowerCase()} practice`
        : "Start with one focused interview",
      detail: mockReport.improvements[0],
      source: latest
        ? `${latest.role} · sample score ${latest.score}/100`
        : "Sample interview guidance",
      href: "/dashboard/interview/setup",
      action: "Practise an interview",
    },
    {
      id: "communication",
      category: "Communication",
      title: "Lead with the point, then the example",
      detail:
        "Try a 60-second answer: state your decision, give one specific example, and finish with a concrete outcome. Pause before adding detail.",
      source: "Prewritten communication recommendation",
      href: "/dashboard/interview/setup?type=Behavioral",
      action: "Practise a behavioral answer",
    },
    {
      id: "technical-gaps",
      category: "Technical",
      title: "Explain the trade-off, not just the tool",
      detail:
        "In your next technical answer, cover API failure states, testing, and one performance trade-off. These are sample focus areas, not skills inferred from your answers.",
      source: "Sample technical interview feedback",
      href: "/dashboard/interview/setup?type=Technical",
      action: "Practise technical reasoning",
    },
    {
      id: "resume-target",
      category: "Resume",
      title: "Connect your summary to your target role",
      detail:
        resume.improvements[1] ??
        "Make your summary specific to the role you want.",
      source: "Prewritten resume recommendation",
      href: "/dashboard/resume",
      action: "Review your resume",
    },
  ];
  if (includeCoding) {
    const evaluated = rounds.find((round) => round.evaluation);
    items.push({
      id: "coding-reasoning",
      category: "Coding",
      title: "State your invariant before you code",
      detail:
        evaluated?.evaluation?.suggestions[0] ??
        "Explain why your chosen data structure works, then trace a minimal case and discuss complexity.",
      source: evaluated
        ? `Sample evaluation · round ${evaluated.id.slice(-8)}`
        : "Sample Pro coding-round advice",
      href: "/dashboard/coding",
      action: "Open coding rounds",
    });
  }
  return items;
}
