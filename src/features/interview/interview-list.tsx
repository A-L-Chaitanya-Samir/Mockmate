"use client";
import Link from "next/link";
import { useState } from "react";
import {
  MessagesSquare,
  ArrowRight,
  Code2,
  Users,
  Shuffle,
  HeartHandshake,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PageHeading, Badge } from "@/components/ui/primitives";
import { InterviewHistory } from "@/features/dashboard/interview-history";
import { useDemoStore } from "@/stores/demo-store";
import { DEMO_MODE } from "@/lib/mode";
import { LiveInterviewList } from "@/features/live/interviews";
export function InterviewList() {
  return DEMO_MODE ? <DemoInterviewList /> : <LiveInterviewList />;
}
function DemoInterviewList() {
  const [filter, setFilter] = useState("All");
  const sessions = useDemoStore((s) => s.sessions);
  const active = sessions.find((s) => s.status === "active");
  return (
    <>
      <PageHeading
        eyebrow="YOUR SPACE TO PRACTICE"
        title="Confidence comes from showing up."
        description="A safe place to think out loud, test your knowledge, and get ready."
        action={
          <Button asChild>
            <Link href="/dashboard/interview/setup">
              <MessagesSquare size={16} />
              New interview
            </Link>
          </Button>
        }
      />
      {active && (
        <Panel className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div>
            <Badge tone="green">SESSION IN PROGRESS</Badge>
            <h3 className="mt-2">
              Pick up where you left off · {active.config.role}
            </h3>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/interview-room/${active.id}`}>
              <Play size={14} />
              Resume session
            </Link>
          </Button>
        </Panel>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[
          {
            name: "Technical",
            icon: Code2,
            text: "Go deeper into how things work.",
          },
          {
            name: "HR",
            icon: Users,
            text: "Connect your experience to your goals.",
          },
          {
            name: "Behavioral",
            icon: HeartHandshake,
            text: "Turn your experience into a story.",
          },
          { name: "Mixed", icon: Shuffle, text: "A little bit of everything." },
        ].map((x) => (
          <Panel className="flex flex-col" key={x.name}>
            <x.icon size={22} className="text-primary mb-6" />
            <h2 className="text-base">{x.name}</h2>
            <p className="text-subtle text-xs mt-2 mb-5 flex-1">{x.text}</p>
            <Link
              className="text-primary text-xs flex items-center gap-2"
              href={`/dashboard/interview/setup?type=${x.name}`}
            >
              Practice this <ArrowRight size={13} />
            </Link>
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="panel-heading">
          <div>
            <h2>Your practice journal</h2>
            <p className="text-subtle text-[11px] mt-1">
              Sample sessions and your completed demo interviews
            </p>
          </div>
          <label>
            <span className="sr-only">Filter interview history</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {["All", "Technical", "HR", "Behavioral", "Mixed"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <InterviewHistory filter={filter} />
        <Link
          href="/dashboard/analytics"
          className="inline-flex items-center gap-2 text-primary text-xs mt-5"
        >
          Detailed interview performance
          <ArrowRight size={13} />
        </Link>
      </Panel>
    </>
  );
}
