"use client";
import { useState } from "react";
import { ChartNoAxesCombined, Target, Clock3, TrendingUp } from "lucide-react";
import {
  Panel,
  PageHeading,
  Metric,
  CheckList,
  Badge,
} from "@/components/ui/primitives";
import {
  PerformanceChart,
  CompetencyChart,
  SkillChart,
} from "@/components/charts";
import { useDemoStore } from "@/stores/demo-store";
import { InterviewHistory } from "./interview-history";
import { mockReport } from "@/data/mock-data";
import { DEMO_MODE } from "@/lib/mode";
import { LiveDashboard } from "@/features/live/dashboard";
export function Analytics() {
  return DEMO_MODE ? <DemoAnalytics /> : <LiveDashboard analytics />;
}
function DemoAnalytics() {
  const history = useDemoStore((s) => s.history);
  const [range, setRange] = useState("all");
  const shown = range === "recent" ? history.slice(0, 3) : history;
  const average = Math.round(
    shown.reduce((t, h) => t + h.score, 0) / Math.max(1, shown.length),
  );
  const averageFor = (type: string) => {
    const rows = shown.filter((h) => h.type === type);
    return rows.length
      ? Math.round(rows.reduce((s, h) => s + h.score, 0) / rows.length)
      : "—";
  };
  return (
    <>
      <PageHeading
        eyebrow="THE BIGGER PICTURE"
        title="Small steps. Measurable growth."
        description="Reflect on your practice and find your next area of focus."
        action={
          <label className="field">
            <span className="sr-only">Analytics period</span>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="all">All sessions</option>
              <option value="recent">Last 3 sessions</option>
            </select>
          </label>
        }
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Metric
          label="Average score"
          value={average}
          note="Demo session results"
          icon={<TrendingUp />}
        />
        <Metric
          label="Technical average"
          value={averageFor("Technical")}
          note="Technical practice"
          icon={<ChartNoAxesCombined />}
        />
        <Metric
          label="HR average"
          value={averageFor("HR")}
          note="People skills practice"
          icon={<Target />}
        />
        <Metric
          label="Practice minutes"
          value={shown.reduce((t, h) => t + h.duration, 0)}
          note="Invested in your growth"
          icon={<Clock3 />}
        />
      </div>
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 mb-6">
        <Panel>
          <div className="panel-heading">
            <h2>Performance over time</h2>
            <Badge tone="muted">Simulated scores</Badge>
          </div>
          <PerformanceChart
            height={280}
            data={[...shown]
              .reverse()
              .map((h, i) => ({ label: `Session ${i + 1}`, score: h.score }))}
          />
        </Panel>
        <Panel>
          <h2>Competency overview</h2>
          <CompetencyChart height={300} />
        </Panel>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel>
          <h2 className="mb-5">Skill-wise performance</h2>
          <SkillChart />
        </Panel>
        <Panel>
          <h2 className="mb-5">Build on your strengths</h2>
          <CheckList items={mockReport.strengths} />
          <h2 className="mt-8 mb-5">Your next growth areas</h2>
          <CheckList items={mockReport.improvements} warning />
        </Panel>
      </div>
      <Panel>
        <h2 className="mb-6">Interview history</h2>
        <InterviewHistory limit={range === "recent" ? 3 : undefined} />
      </Panel>
    </>
  );
}
