"use client";
import { useState } from "react";
import { useDemoStore } from "@/stores/demo-store";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { UpgradeButton } from "@/components/plan-access";
import { Panel, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
export function PlanSettings() {
  const { definition, interviews, can } = useFeatureAccess();
  const setPlan = useDemoStore((s) => s.setPlan);
  const [open, setOpen] = useState(false);
  return (
    <Panel className="mb-6">
      <div className="panel-heading">
        <h2>Plan & demo access</h2>
        <Badge>
          {definition.name} — {definition.price}
        </Badge>
      </div>
      <p className="text-muted text-xs mb-5">
        {interviews.remaining} of {interviews.limit} interview sessions remain
        in this browser. Plan access is simulated locally; no payment, billing
        frequency, or real subscription is established.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {can("codingRounds") ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Switch to Free demo
          </Button>
        ) : (
          <UpgradeButton />
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Switch to Free demo?"
        description="Coding rounds, advanced resume recommendations, and detailed feedback will be locked. Your existing interviews and coding drafts remain saved; a running coding timer continues while away."
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep Pro demo
          </Button>
          <Button
            onClick={() => {
              setPlan("free");
              setOpen(false);
            }}
          >
            Use Free demo
          </Button>
        </div>
      </Dialog>
    </Panel>
  );
}
