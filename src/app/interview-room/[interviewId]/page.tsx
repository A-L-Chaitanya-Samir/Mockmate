import { AppShell } from "@/components/app-shell";
import { InterviewRoom } from "@/features/interview/interview-room";
import { requireAccount } from "@/lib/supabase/server";
export const metadata = { title: "Interview Room" };
export default async function Page({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const { interviewId } = await params;
  await requireAccount();
  return (
    <AppShell room>
      <InterviewRoom interviewId={interviewId} />
    </AppShell>
  );
}
