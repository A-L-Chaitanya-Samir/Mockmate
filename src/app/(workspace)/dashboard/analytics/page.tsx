import { Analytics } from "@/features/dashboard/analytics";
import { FeatureGate, UpgradePrompt } from "@/components/plan-access";
import { PageHeading } from "@/components/ui/primitives";
import { DEMO_MODE } from "@/lib/mode";
export const metadata = { title: "Analytics" };
export default function Page() {
  if (!DEMO_MODE) return <Analytics />;
  return (
    <FeatureGate
      feature="detailedFeedback"
      fallback={
        <>
          <PageHeading
            title="Interview performance"
            description="Review your progress with detailed Pro feedback."
          />
          <UpgradePrompt
            compact
            title="A closer look at your interview performance."
            description="Pro adds detailed performance charts and competency comparisons. Your basic interview reports remain available on Free."
            destination="/dashboard/analytics"
          />
        </>
      }
    >
      <Analytics />
    </FeatureGate>
  );
}
