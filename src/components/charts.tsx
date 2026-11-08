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
const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--foreground)",
};
const axis = { fill: "var(--subtle)", fontSize: 10 };
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
      style={{ height, minWidth: 0 }}
      aria-label="Interview scores over time"
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
export function CompetencyChart({ height = 230 }: { height?: number }) {
  const ready = useHydrated();
  return (
    <div
      style={{ height, minWidth: 0 }}
      role="img"
      aria-label="Sample competencies: technical 85, communication 90, problem solving 86, confidence 82, clarity 88"
    >
      {ready && (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={mockReport.scores.map((item) => ({
              ...item,
              axis:
                item.skill === "Communication"
                  ? "Comms"
                  : item.skill === "Problem solving"
                    ? "Reasoning"
                    : item.skill,
            }))}
            outerRadius="58%"
          >
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "var(--muted)", fontSize: 9 }}
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
export function SkillChart() {
  const ready = useHydrated();
  return (
    <div
      style={{ height: 250, minWidth: 0 }}
      role="img"
      aria-label="Sample skill scores"
    >
      {ready && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={mockReport.scores}
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
              width={100}
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
