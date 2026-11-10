import { PricingCards, PricingComparison } from "@/features/marketing/pricing";
import { DemoNotice } from "@/components/ui/primitives";
import { plans } from "@/config/plans";
import { DEMO_MODE } from "@/lib/mode";
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
          {DEMO_MODE ? `Step up to ${plans.pro.name} — ${plans.pro.price} for the simulated coding-round experience.` : "Pro is a preview for operator-controlled testing. Paid checkout is not available."}
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
          {DEMO_MODE ? "Free and Pro have different access in this separate demo. Local plan changes do not create subscriptions, and evaluations remain simulated." : "Both live plans include core resume coaching, text interviews, saved reports and suggestions. Introductory usage is enforced by the server. Coding execution, voice, video and subscriptions are future features."}
        </p>
      </section>
    </>
  );
}
