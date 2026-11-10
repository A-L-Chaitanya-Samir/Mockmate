import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bot,
  Check,
  Code2,
  FileText,
  LayoutDashboard,
  MessagesSquare,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Badge, ScoreRing, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PricingCards } from "./pricing";
import { plans } from "@/config/plans";
import { DEMO_MODE } from "@/lib/mode";
export function Home() {
  return (
    <>
      <section className="hero">
        <Badge>
          <span className="status-dot" /> A little practice. A different kind of
          confidence.
        </Badge>
        <h1>
          Your next opportunity.
          <br />
          <span>Your best prepared self.</span>
        </h1>
        <p>
          From your first resume to your final interview. A focused workspace to
          sharpen your skills, find your voice, and move forward.
        </p>
        <div className="hero-actions">
          <Button asChild>
            <Link href="/register">
              Start your preparation <ArrowUpRight size={16} />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              {DEMO_MODE ? "Explore the demo" : "Open your workspace"} <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
        <span className="hero-note">
          No credit card. No pressure. Just progress. · {DEMO_MODE ? "Phase 1 frontend demo" : "Phase 2 text interviews & resume coaching"}
        </span>
      </section>
      <div
        className="product-preview"
        aria-label="Interactive product preview links"
      >
        <aside className="preview-sidebar">
          <Brand />
          {[
            { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
            {
              icon: FileText,
              label: "Resume Analysis",
              href: "/dashboard/resume",
            },
            {
              icon: MessagesSquare,
              label: "AI Interviews",
              href: "/dashboard/interview",
            },
            {
              icon: Code2,
              label: "Coding Rounds",
              href: "/dashboard/coding",
            },
          ].map((n, i) => (
            <Link href={n.href} key={n.href}>
              <p className={i === 2 ? "active" : ""}>
                <n.icon size={13} />
                {n.label}
              </p>
            </Link>
          ))}
        </aside>
        <div className="preview-center">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center text-[11px]">
              <span className="status-dot" />
              Your space to get better
            </div>
            <Badge tone="muted">DEMO PREVIEW</Badge>
          </div>
          <div className="preview-stage">
            <div className="interviewer-orb">
              <AudioLines size={30} />
            </div>
            <h3 className="text-sm">Meet your practice partner.</h3>
            <p className="text-subtle text-[10px] mt-1">
              A thoughtful conversation. A stronger you.
            </p>
            <Button asChild size="sm" variant="secondary" className="mt-5">
              <Link href="/dashboard/interview/setup">
                Try an interview <ArrowRight size={12} />
              </Link>
            </Button>
          </div>
          <div className="preview-question">
            <span className="text-primary text-[10px] flex items-center gap-2">
              <Bot size={14} />
              YOUR NEXT QUESTION
            </span>
            <p>Tell me about a challenge that changed the way you think.</p>
            <div className="waveform mt-3" aria-hidden="true">
              {Array.from({ length: 60 }, (_, i) => (
                <span
                  key={i}
                  style={{ height: 5 + Math.abs(Math.sin(i * 0.55)) * 20 }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="preview-performance">
          <h3 className="text-xs">Every answer is progress.</h3>
          <ScoreRing score={87} label="Sample score" size={135} />
          <div className="space-y-4">
            <Progress label="Communication" value={90} />
            <Progress label="Technical knowledge" value={85} />
            <Progress label="Clarity" value={88} />
          </div>
          <div className="flex gap-2 mt-6 text-success text-[10px]">
            <Check size={14} />
            Build on what’s working.
          </div>
        </div>
      </div>
      <section className="marketing-section">
        <div className="section-intro">
          <div>
            <p className="eyebrow">PREPARE WITH INTENTION</p>
            <h2>
              One workspace.
              <br />
              Four ways to get ready.
            </h2>
          </div>
          <p>
            Preparation works best when it’s connected. Bring your resume,
            skills, and interview practice into focus.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-x-8 gap-y-4">
          {[
            {
              icon: MessagesSquare,
              title: "AI Interview Practice",
              text: "Technical, behavioral, or a bit of both. Prepare for the questions that matter.",
              href: "/dashboard/interview",
            },
            {
              icon: FileText,
              title: "Resume Analysis",
              text: "Explore your resume’s strengths and discover ways to make your experience stand out.",
              href: "/dashboard/resume",
            },
            {
              icon: Code2,
              title: "AI Coding Rounds · Pro",
              text: "Work through a timed technical interview, explain your approach, and explore simulated evaluation.",
              href: "/dashboard/coding",
            },
            {
              icon: Target,
              title: "Suggestions & Career Advice",
              text: "Understand resume improvements, communication gaps, and practical areas to practise next.",
              href: "/dashboard/suggestions",
            },
          ].map((f) => (
            <article key={f.title} className="feature-block">
              <f.icon />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <Link
                href={f.href}
                className="text-primary text-xs mt-4 inline-flex items-center gap-2"
              >
                Explore feature <ArrowUpRight size={13} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="marketing-section">
        <div className="section-intro">
          <div>
            <p className="eyebrow">A SIMPLE WAY FORWARD</p>
            <h2>
              Less overthinking.
              <br />
              More getting ready.
            </h2>
          </div>
          <p>
            A repeatable practice loop that fits around your studies, projects,
            and ambitions.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Make it yours",
              text: "Choose your role, interview style, and challenge level.",
            },
            {
              title: "Show up and practice",
              text: "Work through a guided conversation at your own pace.",
            },
            {
              title: "Reflect. Then repeat.",
              text: "Review sample feedback, find a focus, and try again.",
            },
          ].map((s, i) => (
            <article key={s.title} className="feature-block">
              <span className="step-number">0{i + 1} /</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="marketing-section">
        <div className="section-intro">
          <div>
            <p className="eyebrow">ROOM TO GROW</p>
            <h2>
              An investment
              <br />
              in your next chapter.
            </h2>
          </div>
          <p>
            Free preparation essentials, or {plans.pro.name} — {plans.pro.price}{" "}
            for coding rounds and advanced feedback. No payment is taken in this
            demo.
          </p>
        </div>
        <PricingCards />
      </section>
      <section className="marketing-section">
        <div className="section-intro">
          <div>
            <p className="eyebrow">GOOD QUESTIONS</p>
            <h2>A little more clarity.</h2>
          </div>
        </div>
        {[
          {
            q: "Is Mockmate using real AI in this demo?",
            a: "No. This Phase 1 portfolio frontend uses predefined questions, sample evaluations, and simulated service responses. Real AI processing is planned for Phase 2.",
          },
          {
            q: "Do I need to turn on my camera?",
            a: "No. Text mode works without device access. Camera preview is optional and stays on your device. This demo never records or uploads audio or video.",
          },
          {
            q: "What happens to my resume?",
            a: "The PDF stays in your browser. Only the file name, size, date, and predefined demo analysis are saved locally. No resume text is extracted or uploaded.",
          },
          {
            q: "Can I use this to prepare for a real interview?",
            a: "Use the practice prompts and career suggestions to rehearse. The sample scores do not measure your actual ability or predict hiring outcomes.",
          },
          {
            q: "How does demo sign-in work?",
            a: "Any valid form input opens a local demo session. No real account is created and no password is saved. You can also use the demo login button.",
          },
        ].map((f) => (
          <details key={f.q}>
            <summary>
              {f.q}
              <Plus size={17} />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
      <section className="text-center py-20">
        <Sparkles size={25} className="text-primary mx-auto mb-5" />
        <h2 className="text-3xl tracking-tight">
          You don’t have to feel ready to start.
        </h2>
        <p className="text-muted text-sm mt-4 mb-7">
          That’s what practice is for.
        </p>
        <Button asChild>
          <Link href="/register">
            Take your first step <ArrowRight size={15} />
          </Link>
        </Button>
      </section>
    </>
  );
}
