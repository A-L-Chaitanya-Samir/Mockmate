"use client";
import Link from "next/link";
import { ArrowUpRight, MessagesSquare } from "lucide-react";
import { useDemoStore } from "@/stores/demo-store";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { dateLabel } from "@/lib/utils";
export function InterviewHistory({
  limit,
  filter = "All",
}: {
  limit?: number;
  filter?: string;
}) {
  const history = useDemoStore((s) => s.history);
  const rows = history
    .filter((h) => filter === "All" || h.type === filter)
    .slice(0, limit);
  if (!rows.length)
    return (
      <EmptyState
        icon={<MessagesSquare />}
        title="No interviews yet"
        description="Try a practice session to start building your interview history."
        action={
          <Button asChild>
            <Link href="/dashboard/interview/setup">Start practicing</Link>
          </Button>
        }
      />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>INTERVIEW</th>
            <th>TYPE</th>
            <th>DATE</th>
            <th>SCORE</th>
            <th>REPORT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="flex items-center gap-3">
                  <span className="hidden lg:grid w-8 h-8 place-items-center rounded-lg bg-elevated text-muted">
                    <MessagesSquare size={15} />
                  </span>
                  <div>
                    <strong className="font-medium">{item.role}</strong>
                    <p className="text-subtle text-[10px]">
                      {item.duration} min ·{" "}
                      {item.id.startsWith("sample")
                        ? "Sample session"
                        : "Demo session"}
                    </p>
                  </div>
                </div>
              </td>
              <td>
                <Badge tone={item.type === "Technical" ? "blue" : "muted"}>
                  {item.type}
                </Badge>
              </td>
              <td className="text-muted">{dateLabel(item.date)}</td>
              <td>
                <span className="text-success font-medium">{item.score}</span>
                <span className="text-subtle text-[10px]"> / 100</span>
              </td>
              <td>
                <Button asChild variant="ghost" size="icon">
                  <Link
                    href={`/dashboard/interview/${item.id}/report`}
                    aria-label={`View ${item.role} report`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
