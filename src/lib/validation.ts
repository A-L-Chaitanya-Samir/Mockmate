import { z } from "zod";
export const interviewTypeSchema = z.enum([
  "Technical",
  "HR",
  "Behavioral",
  "Mixed",
]);
export const interviewModeSchema = z.enum(["Text", "Voice", "Video"]);
export const configSchema = z.object({
  type: interviewTypeSchema,
  role: z
    .string()
    .trim()
    .min(3, "Enter a role with at least 3 characters.")
    .max(100),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  language: z.enum(["Java", "Python", "C++", "JavaScript"]),
  duration: z
    .number()
    .refine(
      (v) => [10, 15, 20, 30, 45].includes(v),
      "Choose a supported duration.",
    ),
  mode: interviewModeSchema,
});
const date = z.string().refine((v) => Number.isFinite(Date.parse(v)));
const score = z.number().min(0).max(100);
export const sessionSchema = z.object({
  id: z.string(),
  config: configSchema,
  createdAt: date,
  answers: z.array(
    z.object({ questionId: z.string(), text: z.string().max(10000) }),
  ),
  currentIndex: z.number().int().min(0).max(3),
  elapsed: z.number().int().nonnegative(),
  status: z.enum(["active", "completed"]),
});
export const resumeSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().nonnegative(),
  date,
  analysis: z.object({
    score,
    skills: z.array(z.object({ skill: z.string(), score })),
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
  }),
});
export const summarySchema = z.object({
  id: z.string(),
  role: z.string(),
  type: interviewTypeSchema,
  date,
  score,
  duration: z.number().nonnegative(),
});
