import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main-content" className="empty-state min-h-screen">
      <span className="eyebrow">404 · OFF THE ROADMAP</span>
      <h1>Let’s get you back on track.</h1>
      <p className="text-muted">
        This page doesn’t exist. Your next opportunity still does.
      </p>
      <Button asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </main>
  );
}
