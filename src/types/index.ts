export type InterviewType = "Technical" | "HR" | "Behavioral" | "Mixed";
export type InterviewMode = "Text" | "Voice" | "Video";
export interface InterviewConfig {
  type: InterviewType;
  role: string;
  difficulty: "Easy" | "Medium" | "Hard";
  language: "Java" | "Python" | "C++" | "JavaScript";
  duration: number;
  mode: InterviewMode;
}
export interface Question {
  id: string;
  prompt: string;
  topic: string;
  guidance: string;
}
export interface Answer {
  questionId: string;
  text: string;
}
export interface InterviewSession {
  id: string;
  config: InterviewConfig;
  createdAt: string;
  answers: Answer[];
  currentIndex: number;
  elapsed: number;
  status: "active" | "completed";
}
export interface InterviewSummary {
  id: string;
  role: string;
  type: InterviewType;
  date: string;
  score: number;
  duration: number;
}
export interface InterviewReport {
  overall: number;
  scores: { skill: string; score: number }[];
  strengths: string[];
  improvements: string[];
  topics: string[];
}
export interface ResumeAnalysis {
  score: number;
  skills: { skill: string; score: number }[];
  strengths: string[];
  improvements: string[];
}
export interface ResumeRecord {
  id: string;
  name: string;
  size: number;
  date: string;
  analysis: ResumeAnalysis;
}
export interface Profile {
  name: string;
  role: string;
  bio: string;
}
export interface Preferences {
  notifications: boolean;
  reminders: boolean;
  defaultType: InterviewType;
  defaultMode: InterviewMode;
}
