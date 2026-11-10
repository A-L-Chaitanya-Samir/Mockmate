import Link from "next/link";
import { ArrowRight, Code2, Sparkles } from "lucide-react";
import { plans, planOrder, planComparison } from "@/config/plans";
import { UpgradeButton } from "@/components/plan-access";
import { Badge, Panel, CheckList } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/mode";
export function PricingCards() {
  return (
    <div
      className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
      data-testid="pricing-plans"
    >
      {planOrder.map((id) => {
        const plan = plans[id];
        return (
          <Panel
            className={`pricing-card ${plan.recommended ? "pricing-featured" : ""}`}
            key={id}
            data-testid={`plan-${id}`}
          >
            <Badge tone={plan.recommended ? "blue" : "muted"}>
              {plan.recommended && <Sparkles size={11} />}
              {plan.recommended ? "RECOMMENDED UPGRADE" : "A STRONG START"}
            </Badge>
            <h3>{plan.name}</h3>
            <p className="text-muted text-xs mt-2">
              {DEMO_MODE
                ? plan.description
                : plan.recommended
                  ? "Preview of a larger practice allowance. Checkout is not enabled."
                  : "Build a strong foundation with resume coaching and text interviews."}
            </p>
            <div className="price">{plan.price}</div>
            {DEMO_MODE && plan.capabilities.codingRounds && (
              <div className="pro-differentiator">
                <Code2 size={21} />
                <div>
                  <strong>Built for the coding interview.</strong>
                  <p>
                    Full coding rounds, interviewer follow-ups, and a simulated
                    evaluation interface.
                  </p>
                </div>
              </div>
            )}
            <CheckList
              items={
                DEMO_MODE
                  ? plan.benefits
                  : [
                      "PDF resume analysis with evidence",
                      "Text interviews and saved reports",
                      "Analytics and practice suggestions",
                      plan.recommended
                        ? "Larger operator-controlled test allowance"
                        : "Introductory account allowance",
                      "Coding, voice, video and payments: future features",
                    ]
              }
            />
            <p className="text-subtle text-[10px] mb-5">
              {DEMO_MODE
                ? `${plan.limits.interviews} created sessions in this browser. Sample history does not use your allowance.`
                : "Introductory usage is controlled by the server. Pro pricing is a preview; paid checkout is unavailable."}
            </p>
            {plan.recommended ? (
              <UpgradeButton destination="/dashboard/coding" />
            ) : (
              <Button asChild variant="secondary">
                <Link href="/register">
                  Get Started Free
                  <ArrowRight size={14} />
                </Link>
              </Button>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
export function PricingComparison() {
  return (
    <section className="marketing-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow">THE DIFFERENCE, CLEARLY</p>
          <h2>
            Four core capabilities.
            <br />
            Two ways to prepare.
          </h2>
        </div>
        <p>
          {DEMO_MODE
            ? "Coding rounds are the main Pro difference. AI generation and evaluation use mock data in the demo."
            : "Both plans support resume coaching and text interviews. Pro is available for server-controlled testing only; coding, voice, video and checkout are future features."}
        </p>
      </div>
      <div className="table-wrap">
        <table aria-label="Free and Pro comparison">
          <thead>
            <tr>
              <th>CAPABILITY</th>
              <th>FREE — {plans.free.price}</th>
              <th>PRO — {plans.pro.price}</th>
            </tr>
          </thead>
          <tbody>
            {(DEMO_MODE
              ? planComparison
              : [
                  {
                    label: "Resume coaching & text interviews",
                    free: "Included",
                    pro: "Included",
                    coding: false,
                  },
                  {
                    label: "Reports, analytics & suggestions",
                    free: "Included",
                    pro: "Included",
                    coding: false,
                  },
                  {
                    label: "Usage",
                    free: "Introductory allowance",
                    pro: "Larger test allowance",
                    coding: false,
                  },
                  {
                    label: "Coding, voice & video",
                    free: "Future",
                    pro: "Future",
                    coding: true,
                  },
                  {
                    label: "Paid checkout",
                    free: "Unavailable",
                    pro: "Unavailable",
                    coding: false,
                  },
                ]
            ).map((row) => (
              <tr
                className={row.coding ? "pricing-coding-row" : ""}
                key={row.label}
              >
                <td>
                  {row.coding && (
                    <Code2 size={14} className="inline mr-2 text-primary" />
                  )}
                  {row.label}
                </td>
                <td className="text-muted">{row.free}</td>
                <td className="text-primary">{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-subtle text-[10px] mt-5">
        {DEMO_MODE
          ? "Prices have no stated billing frequency. Demo plans never take payment. Quotas are browser-local."
          : "Prices are a presentation preview without a billing frequency. No subscriptions or payments are enabled. Introductory allowances are server-controlled and do not renew monthly."}
      </p>
    </section>
  );
}
