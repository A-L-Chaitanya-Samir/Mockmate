import { InterviewSetup } from "@/features/interview/interview-setup";
export const metadata = { title: "Set up an interview" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  return <InterviewSetup initialType={params.type} />;
}
