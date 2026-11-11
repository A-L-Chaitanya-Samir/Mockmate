import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fixtureDetector, deviceCheck } from "./spoken-helpers";

test.skip(
  process.env.MOCKMATE_BROWSER_MODE !== "live",
  "Deterministic live integration harness required",
);
async function login(page: Page, account = 1) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`account${account}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
}

test("email throttling, delivery failure, resend cooldown and expired-link guidance", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("button", { name: "Resend verification email" }),
  ).toHaveCount(0);
  await page.route("**/auth/v1/recover*", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        code: "over_email_send_rate_limit",
        msg: "limited",
      }),
    }),
  );
  await page.getByLabel("Email address").fill("unknown@example.test");
  await page.getByRole("button", { name: "Send recovery email" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "temporarily limited",
  );
  await expect(
    page.getByRole("button", { name: "Send recovery email" }),
  ).toBeDisabled();
  await page.goto("/login?error=invalid_link");
  await expect(page.locator("p[role=alert]")).toContainText(
    "invalid or expired",
  );
  await expect(
    page.getByRole("button", { name: "Resend verification email" }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    "Resend verification here",
  );
  await page.goto("/register");
  await page.route("**/auth/v1/resend*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "unexpected_failure",
        msg: "SMTP details must never be shown",
      }),
    }),
  );
  await page.getByLabel("Email address").fill("unknown@example.test");
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "delivery is temporarily unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Resend verification email" }),
  ).toBeDisabled();
  await expect(page.locator("body")).not.toContainText("SMTP details");
});

test("server-relative renewal and returning from a stale tab refetch eligibility", async ({
  page,
}) => {
  let phase = "expiredSoon",
    reads = 0;
  await page.route("**/api/v1/workspace", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    reads++;
    const exhausted = phase !== "renewed";
    body.capabilities = {
      ...body.capabilities,
      server_time: "2026-11-10T09:00:00Z",
      reset_at:
        phase === "expiredSoon"
          ? "2026-11-10T09:00:00.200Z"
          : "2026-11-11T09:00:00Z",
      window_started_at: "2026-11-10T09:00:00Z",
      window_hours: 24,
      resumes_remaining: 10,
      interviews_remaining: exhausted ? 0 : 3,
      resume: { limit: 10, used: 0, reserved: 0, remaining: 10 },
      interview: {
        limit: 3,
        used: exhausted ? 3 : 0,
        reserved: 0,
        remaining: exhausted ? 0 : 3,
      },
    };
    if (phase === "expiredSoon") phase = "renewed";
    await route.fulfill({ response, json: body });
  });
  await login(page);
  await expect(page.getByLabel("Daily allowances")).toContainText(
    "3 of 3 video interviews",
  );
  expect(reads).toBeGreaterThanOrEqual(2);
  await page.goto("/dashboard/interview/setup");
  phase = "exhausted";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("Daily allowances")).toContainText(
    "0 of 3 video interviews",
  );
  await expect(
    page.getByRole("button", { name: "Continue to device checks" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Daily allowances")).toContainText(
    "your local time",
  );
});

test("protected routes, recovery, registration and invalid redirects", async ({
  page,
}) => {
  await page.goto("/dashboard/resume");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Test Member");
  await page.getByLabel("Email address").fill("new@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("verify your account");
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("account1@example.test");
  await page.getByRole("button", { name: "Send recovery email" }).click();
  await expect(page.getByRole("status")).toContainText("recovery email");
  await page.goto("/auth/callback?next=https://attacker.example");
  await expect(page).toHaveURL(/\/login\?error=invalid_link/);
});

test("saved interview, actual answer report, refresh and account isolation", async ({
  page,
  browser,
}) => {
  await fixtureDetector(page);
  await login(page);
  await page.goto("/dashboard/interview/setup");
  await page
    .getByLabel("Target role", { exact: true })
    .fill("Browser Test Engineer");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Continue to device checks", exact: true })
    .click();
  await expect(page).toHaveURL(/\/interview-room\//);
  await deviceCheck(page);
  const room = page.url();
  const answer =
    "I built a Python API with explicit transactions to preserve data consistency.";
  // A slow acknowledgment must never hide the next spoken question.
  await page.route("**/api/v1/jobs", async (route) => {
    const response = await route.fetch();
    const jobs = await response.json();
    await route.fulfill({
      response,
      json: jobs.map((job: { kind: string; status: string }) =>
        job.kind === "response" ? { ...job, status: "queued" } : job,
      ),
    });
  });
  await page
    .getByRole("button", { name: "Start answering", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Stop & transcribe answer · 2s/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Stop & transcribe answer/ }).click();
  await expect(page.getByLabel("Review transcript")).toHaveValue(answer, {
    timeout: 20000,
  });
  await page
    .getByRole("button", { name: "Submit answer & next question", exact: true })
    .click();
  await expect(page.getByText(answer, { exact: true })).toHaveCount(1);
  await expect(page.getByText(/^Question 2 of /)).toBeVisible();
  await expect(
    page.getByText(/AI feedback is processing; you can continue/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start answering", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await deviceCheck(page);
  await expect(page.getByText(answer, { exact: true })).toHaveCount(1);
  await page
    .getByRole("button", { name: "Complete interview", exact: true })
    .click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(
    page.getByText(/Calculated average of all question marks/),
  ).toBeVisible();
  await expect(page.getByText(/Correctness\/relevance: 66\/100/)).toBeVisible();
  await expect(
    page.getByText(`Answer evidence: “${answer}”`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Answer received: ${answer}`, { exact: true }),
  ).toBeVisible();
  const report = page.url();
  const separate = await browser.newContext();
  const otherDevice = await separate.newPage();
  await login(otherDevice);
  await otherDevice.goto(report);
  await expect(otherDevice.getByText(answer, { exact: true })).toBeVisible();
  await separate.close();
  await page
    .getByRole("button", { name: "Log out", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 2);
  await expect(
    page.getByText("Browser Test Engineer", { exact: true }),
  ).toHaveCount(0);
  await page.goto(report);
  await expect(
    page.getByRole("heading", { name: "Report not found." }),
  ).toBeVisible();
  await page.goto(room);
  await expect(
    page.getByRole("heading", { name: "Session not found." }),
  ).toBeVisible();
});

test("responsive saved-data screens retain usable navigation", async ({
  page,
}) => {
  await login(page, 2);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/dashboard",
      "/dashboard/resume",
      "/dashboard/interview",
      "/dashboard/interview/setup",
      "/dashboard/analytics",
      "/dashboard/suggestions",
      "/dashboard/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("PDF analysis, improvement evidence, export, profile persistence and deletion", async ({
  page,
}) => {
  await login(page, 2);
  await page.goto("/dashboard/resume");
  await page
    .getByLabel("Resume PDF")
    .setInputFiles(path.resolve("backend/tests/fixtures/synthetic-resume.pdf"));
  await page
    .getByLabel("Target role (optional)", { exact: true })
    .fill("Python Engineer");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Analyze resume", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence from your PDF" }),
  ).toBeVisible();
  await expect(
    page.getByText("“Python engineer”", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Evidence from your PDF" }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export analysis" }).click();
  expect((await downloading).suggestedFilename()).toBe(
    "mockmate-resume-analysis.json",
  );
  await page.getByRole("link", { name: "Explore improvements" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Make improvements with verified evidence",
    }),
  ).toBeVisible();
  await page.goto("/dashboard/settings");
  await page.getByLabel("Display name", { exact: true }).fill("Saved Member");
  await page
    .getByRole("combobox", { name: "Default interview type", exact: true })
    .selectOption("Behavioral");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved.");
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Saved Member",
  );
  await expect(
    page.getByRole("combobox", { name: "Default interview type", exact: true }),
  ).toHaveValue("Behavioral");
  await page.goto("/dashboard/resume");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your story starts here." }),
  ).toBeVisible();
});

test("retired routes and promotions are absent in live mode", async ({
  page,
}) => {
  for (const route of ["/dashboard/coding", "/dashboard/coding/old-round"]) {
    expect((await page.goto(route))?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Let’s get you back on track." }),
    ).toBeVisible();
  }
  await page.goto("/pricing");
  await expect(page).toHaveURL("/");
  await login(page, 2);
  for (const route of [
    "/dashboard",
    "/dashboard/settings",
    "/dashboard/suggestions",
  ]) {
    await page.goto(route);
    await expect(
      page
        .getByRole("navigation", { name: "Application navigation" })
        .getByRole("link"),
    ).toHaveCount(5);
    await expect(page.locator("body")).not.toContainText(
      /Mockmate Pro|Upgrade to Pro|Coding Rounds|Your next chapter starts here|Start a session/,
    );
    await expect(
      page.locator('a[href="/pricing"], a[href^="/dashboard/coding"]'),
    ).toHaveCount(0);
  }
});
