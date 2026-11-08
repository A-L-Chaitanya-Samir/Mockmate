import Link from "next/link";
import { ArrowRight, Code2, Sparkles } from "lucide-react";
import { plans, planOrder, planComparison } from "@/config/plans";
import { UpgradeButton } from "@/components/plan-access";
import { Badge, Panel, CheckList } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
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
            <p className="text-muted text-xs mt-2">{plan.description}</p>
            <div className="price">{plan.price}</div>
            {plan.capabilities.codingRounds && (
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
            <CheckList items={plan.benefits} />
            <p className="text-subtle text-[10px] mb-5">
              {plan.limits.interviews} created interview sessions in this
              browser. Sample history doesn’t use your demo allowance.
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
          Coding rounds are the main Pro difference. AI generation, evaluation,
          and recommendations use mock data in Phase 1.
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
            {planComparison.map((row) => (
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
        Prices have no stated billing frequency. Demo plan changes never create
        a subscription or take payment. Quotas are browser-local and
        configurable.
      </p>
    </section>
  );
}
