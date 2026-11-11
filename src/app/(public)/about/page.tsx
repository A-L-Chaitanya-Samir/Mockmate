import Link from "next/link";
import { ArrowRight, Compass, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/mode";
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
              text: DEMO_MODE
                ? "This portfolio demo clearly labels simulated feedback. Your camera and microphone are never recorded or uploaded."
                : "Resume excerpts, answer audio and confirmed transcripts use external AI. Face checks stay local; optional phone checks send separately consented image samples to Groq. Practice observations do not prove cheating.",
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
          Preparation today.
          <br />
          Progress for tomorrow.
        </h2>
        <p className="text-muted max-w-2xl mb-7">
          {DEMO_MODE
            ? "Mockmate’s separate demo build uses simulated services and browser-local data."
            : "Mockmate connects its Next.js and TypeScript interface to Supabase authentication, private storage, PostgreSQL and a FastAPI backend with a durable AI worker. Resume analysis and text interview feedback use your own submitted content."}
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
