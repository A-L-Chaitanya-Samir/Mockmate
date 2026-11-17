"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Lightbulb, ArrowRight } from "lucide-react";
import { useDemoStore } from "@/stores/demo-store";
import {
  Panel,
  PageHeading,
  Badge,
  DemoNotice,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { buildSuggestions } from "./suggestions-data";
import { DEMO_MODE } from "@/lib/mode";
import { LiveDashboard } from "@/features/live/dashboard";
export function Suggestions() {
  return DEMO_MODE ? <DemoSuggestions /> : <LiveDashboard suggestions />;
}
function DemoSuggestions() {
  const { resumes, history, profile } = useDemoStore();
  const [category, setCategory] = useState("All advice");
  const items = buildSuggestions(resumes, history);
  const categories = [
    "All advice",
    "Resume",
    "Interviews",
    "Communication",
    "Technical",
  ];
  return (
    <>
      <PageHeading
        eyebrow="KNOW WHAT TO IMPROVE NEXT"
        title="Suggestions & Advice"
        description={`${profile.name.split(" ")[0]}, turn your practice into a clear next step. Mock recommendations, with their source shown.`}
      />
      <DemoNotice />
      <div className="dashboard-banner mt-6">
        <div>
          <Badge>
            <Lightbulb size={12} />
            YOUR NEXT THREE MOVES
          </Badge>
          <h2>
            Make the next attempt
            <br />a little stronger.
          </h2>
          <p>
            Refine a resume bullet. Structure an interview answer. Explain one
            technical decision.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard/interview/setup">
            Put it into practice
            <ArrowRight size={15} />
          </Link>
        </Button>
      </div>
      <div
        className="flex flex-wrap gap-2 mb-6"
        role="group"
        aria-label="Advice category"
      >
        {categories.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? "default" : "secondary"}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {items
          .filter(
            (item) => category === "All advice" || category === item.category,
          )
          .map((item) => (
            <Panel key={item.id}>
              <Badge tone="muted">{item.category}</Badge>
              <h2 className="text-lg mt-4 mb-3">{item.title}</h2>
              <p className="text-muted text-xs leading-7">{item.detail}</p>
              <p className="text-subtle text-[10px] border-t border-border mt-5 pt-4">
                SOURCE · {item.source}
              </p>
              <Link
                href={item.href}
                className="text-primary text-xs flex items-center gap-2 mt-4"
              >
                {item.action}
                <ArrowUpRight size={14} />
              </Link>
            </Panel>
          ))}
      </div>
    </>
  );
}
