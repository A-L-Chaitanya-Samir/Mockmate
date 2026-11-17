"use client";
import Link from "next/link";
import { useUsage } from "@/hooks/use-usage";
import { Panel, Badge } from "./ui/primitives";
import { Button } from "./ui/button";
export function InterviewLimitNotice() {
  const { interviews, resetAt } = useUsage();
  return (
    <Panel className="space-y-4">
      <Badge tone="amber">DEMO PRACTICE LIMIT</Badge>
      <h2>Your {interviews.limit} interview sessions are used.</h2>
      <p className="text-muted text-xs">
        Created sessions count toward this browser’s 24-hour demo limit,
        including unfinished ones. Existing sessions and reports remain
        available.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/dashboard/interview">View your interviews</Link>
        </Button>
      </div>
      <p className="text-subtle text-[10px]">
        {resetAt
          ? `Both demo allowances renew ${new Date(resetAt).toLocaleString()}.`
          : "The 24-hour demo window starts with the first use."}{" "}
        Demo data stays in this browser.
      </p>
    </Panel>
  );
}
