"use client";
import { useState } from "react";
import { useDemoStore } from "@/stores/demo-store";
import { PageHeading, DemoNotice } from "@/components/ui/primitives";
import { FeatureGate } from "@/components/plan-access";
import { CodingSetup } from "./coding-setup";
import { CodingRound } from "./coding-round";
export function CodingWorkspace() {
  return (
    <>
      <PageHeading
        eyebrow="THE TECHNICAL INTERVIEW, IN FOCUS"
        title="Coding Rounds"
        description="Solve a problem. Explain your reasoning. Practise the complete technical interview."
      />
      <FeatureGate feature="codingRounds">
        <CodingContent />
      </FeatureGate>
    </>
  );
}
function CodingContent() {
  const round = useDemoStore((s) => s.codingRounds[0]);
  const [setup, setSetup] = useState(false);
  return (
    <>
      <div className="mb-6">
        <DemoNotice />
      </div>
      {!round || setup ? (
        <CodingSetup onStarted={() => setSetup(false)} />
      ) : (
        <CodingRound
          key={round.id}
          round={round}
          onNew={() => setSetup(true)}
        />
      )}
    </>
  );
}
