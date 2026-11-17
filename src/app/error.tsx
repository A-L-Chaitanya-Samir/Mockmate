"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="empty-state min-h-screen">
      <h1>That didn’t go as planned.</h1>
      <p className="text-muted">
        Your demo may have encountered an unexpected error. Try loading this
        view again.
      </p>
      <Button onClick={reset}>Try again</Button>
      <Button asChild variant="secondary">
        <a href="/dashboard">Back to dashboard</a>
      </Button>
    </main>
  );
}
