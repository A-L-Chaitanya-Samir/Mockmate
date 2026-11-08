import Link from "next/link";
import { ArrowRight, Compass, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
export const metadata = { title: "About" };
export default function Page() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">BUILT FOR THE JOURNEY</p>
        <h1>
          Potential deserves
          <br />a little preparation.
        </h1>
        <p>
          Mockmate is a career readiness workspace designed to make the space
          between learning and opportunity feel a little smaller.
        </p>
      </section>
      <section className="marketing-section">
        <div className="section-intro">
          <h2>
            Skills are only part
            <br />
            of your story.
          </h2>
          <p>
            Being able to explain your thinking, reflect on your work, and
            communicate your potential matters too. Mockmate brings those pieces
            together.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Compass,
              title: "A clear next step",
              text: "Focused workflows that help you choose what to practice, without adding noise.",
            },
            {
              icon: TrendingUp,
              title: "Progress over perfection",
              text: "A repeatable practice loop designed around reflection, learning, and growth.",
            },
            {
              icon: ShieldCheck,
              title: "Honest by design",
              text: "This portfolio demo clearly labels simulated feedback. Your camera and microphone are never recorded or uploaded.",
            },
          ].map((x) => (
            <article className="feature-block" key={x.title}>
              <x.icon />
              <h3>{x.title}</h3>
              <p>{x.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="marketing-section">
        <p className="eyebrow mb-5">THE PROJECT</p>
        <h2 className="text-3xl mb-6">
          A frontend today.
          <br />A foundation for tomorrow.
        </h2>
        <p className="text-muted max-w-2xl mb-7">
          Mockmate is a student portfolio project built with Next.js, React, and
          TypeScript. Phase 1 explores the complete product experience through
          typed mock services. A future phase will connect FastAPI, real
          authentication, and AI services.
        </p>
        <Button asChild>
          <Link href="/dashboard">
            Explore the workspace
            <ArrowRight size={15} />
          </Link>
        </Button>
      </section>
    </>
  );
}
