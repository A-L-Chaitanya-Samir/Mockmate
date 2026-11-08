import { AppShell } from "@/components/app-shell";
import { InterviewRoom } from "@/features/interview/interview-room";
export const metadata = { title: "Interview Room" };
export default async function Page({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const { interviewId } = await params;
  return (
    <AppShell room>
      <InterviewRoom interviewId={interviewId} />
    </AppShell>
  );
}
