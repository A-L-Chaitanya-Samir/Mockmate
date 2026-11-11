import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { DEMO_MODE } from "@/lib/mode";
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="public-nav">
        <Brand />
        <nav aria-label="Public navigation">
          <Link href="/about" className="nav-about">
            The platform
          </Link>
          <Link href="/login" className="hidden sm:block">
            Log in
          </Link>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
          <span className="hidden sm:inline-flex">
            <ThemeToggle />
          </span>
        </nav>
      </header>
      <main id="main-content" className="public-content">
        {children}
      </main>
      <footer className="public-footer">
        <div>
          <Brand />
          <p className="text-subtle text-[10px] mt-3">
            Practice with purpose. Show up with confidence.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/about">About Mockmate</Link>
          <Link href="/dashboard">
            {DEMO_MODE ? "Explore demo" : "Your workspace"}
          </Link>
        </div>
        <p className="text-subtle text-[10px] w-full">
          © {new Date().getFullYear()} Mockmate ·{" "}
          {DEMO_MODE
            ? "Portfolio frontend demo · No real AI processing"
            : "Video interviews & resume coaching · External AI processing"}
        </p>
      </footer>
    </>
  );
}
