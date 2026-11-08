import { mockRequest } from "./api-client";
import { mockReport, mockResume } from "@/data/mock-data";
import type {
  InterviewConfig,
  InterviewSession,
  ResumeAnalysis,
  InterviewReport,
} from "@/types";
export const authService = {
  signIn: async () =>
    mockRequest(() => ({
      name: "Alex Morgan",
      role: "Aspiring Software Engineer",
      bio: "Building, learning, and preparing for what’s next.",
    })),
  resetPassword: async () =>
    mockRequest(() => ({
      message: "Demo request complete. No email was sent.",
    })),
};
export const resumeService = {
  analyze: async (): Promise<ResumeAnalysis> =>
    mockRequest(() => mockResume, 1200),
};
export const interviewService = {
  create: async (config: InterviewConfig): Promise<InterviewSession> =>
    mockRequest(() => ({
      id: `demo-${crypto.randomUUID()}`,
      config,
      createdAt: new Date().toISOString(),
      answers: [],
      currentIndex: 0,
      elapsed: 0,
      status: "active",
    })),
  respond: async () =>
    mockRequest(
      () =>
        "Thanks for sharing. In a real interview, I’d ask you to expand on your decisions and the outcome. Let’s move to the next question.",
      600,
    ),
  evaluate: async (): Promise<InterviewReport> =>
    mockRequest(() => mockReport, 1000),
};
