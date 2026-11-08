import type {
  InterviewSummary,
  InterviewReport,
  ResumeAnalysis,
  Question,
  InterviewType,
} from "@/types";
// All scores and feedback are fixtures. No AI evaluation runs in Phase 1.
export const seedHistory: InterviewSummary[] = [
  {
    id: "sample-frontend",
    role: "Frontend Developer",
    type: "Technical",
    date: "2026-11-07T10:00:00Z",
    score: 87,
    duration: 25,
  },
  {
    id: "sample-behavioral",
    role: "Software Engineer",
    type: "Behavioral",
    date: "2026-11-05T10:00:00Z",
    score: 82,
    duration: 20,
  },
  {
    id: "sample-python",
    role: "Python Developer",
    type: "Technical",
    date: "2026-11-03T10:00:00Z",
    score: 78,
    duration: 30,
  },
  {
    id: "sample-hr",
    role: "Software Engineer",
    type: "HR",
    date: "2026-10-29T10:00:00Z",
    score: 75,
    duration: 15,
  },
  {
    id: "sample-mixed",
    role: "Full Stack Developer",
    type: "Mixed",
    date: "2026-10-25T10:00:00Z",
    score: 72,
    duration: 30,
  },
];
export const mockReport: InterviewReport = {
  overall: 87,
  scores: [
    { skill: "Technical", score: 85 },
    { skill: "Communication", score: 90 },
    { skill: "Problem solving", score: 86 },
    { skill: "Confidence", score: 82 },
    { skill: "Clarity", score: 88 },
  ],
  strengths: [
    "Clear explanations with a logical structure",
    "Good understanding of core technical concepts",
    "Thoughtful consideration of trade-offs",
  ],
  improvements: [
    "Use the STAR method for behavioral answers",
    "Quantify the impact of your project decisions",
    "Discuss edge cases before proposing a solution",
  ],
  topics: [
    "System design fundamentals",
    "React rendering and performance",
    "Behavioral storytelling",
  ],
};
export const mockResume: ResumeAnalysis = {
  score: 81,
  skills: [
    { skill: "Technical skills", score: 89 },
    { skill: "Project impact", score: 76 },
    { skill: "Experience", score: 72 },
    { skill: "ATS readability", score: 88 },
    { skill: "Communication", score: 68 },
  ],
  strengths: [
    "Relevant technical stack and well-organized skills",
    "Strong academic projects with clear ownership",
    "Readable, consistent resume structure",
  ],
  improvements: [
    "Add measurable outcomes to project bullets",
    "Tailor your summary to your target role",
    "Include testing and deployment experience",
  ],
};
const technical: Question[] = [
  {
    id: "tech-1",
    prompt:
      "Tell me about a technical challenge you faced in a project. How did you approach it?",
    topic: "Problem solving",
    guidance:
      "Set the context, explain your decisions, and finish with the outcome.",
  },
  {
    id: "tech-2",
    prompt:
      "How would you design a reliable API integration in a frontend application?",
    topic: "Architecture",
    guidance:
      "Consider loading states, errors, retries, and separation of concerns.",
  },
  {
    id: "tech-3",
    prompt: "Explain how you would investigate a slow web application.",
    topic: "Performance",
    guidance:
      "Start with measurement, form a hypothesis, and validate the improvement.",
  },
  {
    id: "tech-4",
    prompt: "How do you test a feature before shipping it?",
    topic: "Quality",
    guidance:
      "Describe unit, integration, accessibility, and user-flow testing.",
  },
];
const behavioral: Question[] = [
  {
    id: "behavior-1",
    prompt:
      "Tell me about a time you worked through a disagreement with a teammate.",
    topic: "Teamwork",
    guidance:
      "Use situation, task, action, and result to structure your answer.",
  },
  {
    id: "behavior-2",
    prompt:
      "Describe a project where you had to learn something new under a deadline.",
    topic: "Adaptability",
    guidance:
      "Explain your priorities and what you learned from the experience.",
  },
  {
    id: "behavior-3",
    prompt: "Tell me about a mistake you made and how you responded.",
    topic: "Ownership",
    guidance: "Focus on accountability, the correction, and prevention.",
  },
  {
    id: "behavior-4",
    prompt: "How do you explain a complex idea to a non-technical stakeholder?",
    topic: "Communication",
    guidance:
      "Give a concrete example and explain how you checked understanding.",
  },
];
const hr: Question[] = [
  {
    id: "hr-1",
    prompt:
      "Walk me through your background and what you are looking for in your next role.",
    topic: "Introduction",
    guidance: "Connect your experience and interests to the role.",
  },
  {
    id: "hr-2",
    prompt: "What motivates you to work in software engineering?",
    topic: "Motivation",
    guidance: "Share a specific experience that shaped your interest.",
  },
  {
    id: "hr-3",
    prompt: "What is a skill you are currently working to improve?",
    topic: "Growth",
    guidance: "Describe the steps you are taking and how you measure progress.",
  },
  {
    id: "hr-4",
    prompt: "What questions would you ask a potential employer?",
    topic: "Role fit",
    guidance: "Think about mentorship, expectations, and team culture.",
  },
];
export function questionsFor(type: InterviewType): Question[] {
  return type === "Technical"
    ? technical
    : type === "HR"
      ? hr
      : type === "Behavioral"
        ? behavioral
        : [technical[0], hr[1], technical[2], behavioral[3]];
}
