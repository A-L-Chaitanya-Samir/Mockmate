"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  BarChart,
  Bar,
} from "recharts";
import { useHydrated } from "@/hooks/use-hydrated";
import { mockReport } from "@/data/mock-data";
import { DEMO_MODE } from "@/lib/mode";
const defaultScores = DEMO_MODE ? mockReport.scores : [];
const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: "0.75rem",
  color: "var(--foreground)",
};
const axis = { fill: "var(--subtle)", fontSize: "0.6875rem" };
const chartLabels: Record<string, string> = {
  Communication: "Comms",
  "Problem solving": "Reasoning",
  "Correctness & relevance": "Correctness",
  "Reasoning & evidence": "Reasoning",
  "Text clarity & structure": "Clarity",
};
export function PerformanceChart({
  data,
  height = 240,
}: {
  data: { label: string; score: number }[];
  height?: number;
}) {
  const ready = useHydrated();
  return (
    <div
      style={{ height: `${height / 16}rem`, minWidth: 0 }}
      aria-label={`Interview scores over time: ${data.map((item) => `${item.label}: ${item.score}`).join(", ") || "No completed interviews"}`}
      role="img"
    >
      {ready && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 15, right: 10, left: -30, bottom: 0 }}
          >
            <defs>
              <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity={0.24}
                />
                <stop
                  offset="100%"
                  stopColor="var(--primary)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={axis}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={axis}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: "var(--primary)", strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="score"
              name="Score"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#scoreFill)"
              isAnimationActive={false}
              dot={{ r: 3, fill: "var(--surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
export function CompetencyChart({
  height = 230,
  scores = defaultScores,
}: {
  height?: number;
  scores?: { skill: string; score: number }[];
}) {
  const ready = useHydrated();
  return (
    <div
      style={{ height: `${height / 16}rem`, minWidth: 0 }}
      role="img"
      aria-label={`${DEMO_MODE ? "Sample competencies: " : "Text competencies: "}${scores.map((s) => `${s.skill}: ${s.score}`).join(", ")}`}
    >
      {ready && (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={scores.map((item) => ({
              ...item,
              axis: chartLabels[item.skill] || item.skill,
            }))}
            outerRadius="58%"
          >
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "var(--muted)", fontSize: "0.6875rem" }}
            />
            <Radar
              dataKey="score"
              name="Demo score"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.2}
              isAnimationActive={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
export function SkillChart({
  scores = defaultScores,
}: {
  scores?: { skill: string; score: number }[];
}) {
  const ready = useHydrated();
  return (
    <div
      style={{ height: "15.625rem", minWidth: 0 }}
      role="img"
      aria-label={`Skill scores: ${scores.map((item) => `${item.skill}: ${item.score}`).join(", ") || "No scores available"}`}
    >
      {ready && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={scores}
            layout="vertical"
            margin={{ left: 0, right: 15 }}
          >
            <CartesianGrid
              stroke="var(--border)"
              horizontal={false}
              strokeDasharray="3 5"
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={axis}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="skill"
              tickFormatter={(value: string) => chartLabels[value] || value}
              width={120}
              tick={axis}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--primary-soft)" }}
            />
            <Bar
              dataKey="score"
              fill="var(--primary)"
              barSize={12}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
