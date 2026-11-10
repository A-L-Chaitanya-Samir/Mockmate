"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Code2, LockKeyhole, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { plans, type Feature } from "@/config/plans";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useDemoReady } from "@/hooks/use-demo-ready";
import { useDemoStore } from "@/stores/demo-store";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Panel, Badge, CheckList, Skeleton } from "./ui/primitives";
import { DEMO_MODE } from "@/lib/mode";
export function UpgradeButton({
  label = "Upgrade to Pro",
  destination,
}: {
  label?: string;
  destination?: string;
}) {
  return DEMO_MODE ? <DemoUpgradeButton label={label} destination={destination} /> : <Button disabled variant="secondary">Pro checkout coming later</Button>;
}
function DemoUpgradeButton({ label = "Upgrade to Pro", destination }: { label?: string; destination?: string }) {
  const [open, setOpen] = useState(false);
  const setPlan = useDemoStore((s) => s.setPlan);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Sparkles size={15} />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`${plans.pro.name} — ${plans.pro.price}`}
        description="Enable a simulated Pro plan in this browser. No payment is collected, no billing interval is implied, and no real subscription is created."
      >
        <p className="text-muted text-xs mb-6">
          This unlocks coding rounds, advanced resume recommendations, and
          detailed sample feedback. Access is frontend-only and can be changed
          in Settings.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep current plan
          </Button>
          <Button
            onClick={() => {
              setPlan("pro");
              setOpen(false);
              toast.success("Pro demo enabled. No payment was taken.");
              if (destination) router.push(destination);
            }}
          >
            Enable Pro demo
            <ArrowRight size={14} />
          </Button>
        </div>
      </Dialog>
    </>
  );
}
export function UpgradePrompt({
  title = "Your technical interview starts with Pro.",
  compact = false,
  description = "A structured coding interview, with a problem-solving environment, language selection, interviewer follow-ups, and simulated evaluation.",
  destination = "/dashboard/coding",
}: {
  title?: string;
  compact?: boolean;
  description?: string;
  destination?: string;
}) {
  return (
    <Panel className={compact ? "space-y-4" : "upgrade-panel"}>
      <div className="feature-icon">
        <Code2 size={24} />
      </div>
      <Badge>
        <LockKeyhole size={11} />
        PRO EXCLUSIVE
      </Badge>
      <h2 className={compact ? "text-lg" : "text-3xl mt-5 mb-3"}>{title}</h2>
      <p className="text-muted text-xs leading-6">{description}</p>
      {!compact && (
        <div className="my-7">
          <CheckList
            items={[
              "Technical coding interview simulations",
              "Feedback on correctness, approach, and complexity",
              "Transparent interview integrity indicators",
            ]}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 mt-5">
        <UpgradeButton destination={destination} />
        <span className="text-muted text-xs">
          {plans.pro.name} — {plans.pro.price}
        </span>
      </div>
      <p className="text-subtle text-[10px] mt-3">
        Phase 1 demo access · No checkout or real AI evaluation
      </p>
    </Panel>
  );
}
export function FeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const ready = useDemoReady();
  const { can } = useFeatureAccess();
  if (!ready) return <Skeleton />;
  return can(feature) ? children : (fallback ?? <UpgradePrompt />);
}
export function InterviewLimitNotice() {
  const { interviews } = useFeatureAccess();
  return (
    <Panel className="space-y-4">
      <Badge tone="amber">DEMO PRACTICE LIMIT</Badge>
      <h2>Your {interviews.limit} interview sessions are used.</h2>
      <p className="text-muted text-xs">
        Created sessions count toward this browser’s demo limit, including
        unfinished ones. Existing sessions and reports remain available.
      </p>
      <div className="flex flex-wrap gap-3">
        <UpgradeButton label="Explore Pro access" />
        <Button asChild variant="secondary">
          <Link href="/dashboard/interview">View your interviews</Link>
        </Button>
      </div>
      <p className="text-subtle text-[10px]">
        These are configurable demo quotas, not monthly or annual allowances.
        Settings can reset disposable demo data.
      </p>
    </Panel>
  );
}
