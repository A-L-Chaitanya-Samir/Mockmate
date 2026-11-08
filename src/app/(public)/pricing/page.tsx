import { PricingCards, PricingComparison } from "@/features/marketing/pricing";
import { DemoNotice } from "@/components/ui/primitives";
import { plans } from "@/config/plans";
export const metadata = { title: "Pricing" };
export default function Page() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">PREPARATION THAT FITS</p>
        <h1>
          Make room
          <br />
          for what’s next.
        </h1>
        <p>
          Start Free with resume analysis, interviews, and practical advice.
          Step up to {plans.pro.name} — {plans.pro.price} for the complete
          coding-round experience.
        </p>
      </section>
      <PricingCards />
      <PricingComparison />
      <div className="my-10">
        <DemoNotice />
      </div>
      <section className="marketing-section">
        <h2 className="mb-6">Try the experience. No checkout required.</h2>
        <p className="text-muted max-w-2xl">
          Free and Pro have different feature access in this demo. Upgrade to
          enable a simulated Pro plan locally, without entering payment details.
          Resume insights, interview responses, coding questions, and
          evaluations remain simulated. Production subscription verification is
          planned for Phase 2.
        </p>
      </section>
    </>
  );
}
