import { InterviewReport } from "@/features/interview/interview-report";
export const metadata = { title: "Interview Report" };
export default async function Page({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const { interviewId } = await params;
  return <InterviewReport interviewId={interviewId} />;
}
