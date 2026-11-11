import { test, expect } from "@playwright/test";
import { DEMO_INTERVIEW_LIMIT } from "../src/config/usage";
import { mockReport } from "../src/data/mock-data";
import { readFile } from "node:fs/promises";

test("demo allowances renew together without removing saved sessions", async ({
  page,
}) => {
  await page.goto("/dashboard/interview/setup");
  await page.getByRole("button", { name: "Start my practice" }).click();
  await expect(page).toHaveURL(/interview-room\/demo-/);
  const savedId = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("mockmate-demo-v1")!);
    const id = data.state.sessions[0].id;
    data.state.usage = {
      startedAt: Date.now() - 86400000,
      resumes: 10,
      interviews: 3,
    };
    localStorage.setItem("mockmate-demo-v1", JSON.stringify(data));
    return id;
  });
  await page.goto("/dashboard/interview/setup");
  await expect(page.locator("body")).toContainText(
    "3 of 3 demo sessions remaining",
  );
  await page.getByRole("button", { name: "Start my practice" }).click();
  await expect(page).toHaveURL(/interview-room\/demo-/);
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem("mockmate-demo-v1")!).state,
  );
  expect(state.usage.resumes).toBe(0);
  expect(state.usage.interviews).toBe(1);
  expect(state.sessions.some((s: { id: string }) => s.id === savedId)).toBe(
    true,
  );
});

test("single free workspace has no retired navigation or sidebar promotion", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL("/");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/dashboard",
      "/dashboard/settings",
      "/dashboard/suggestions",
      "/dashboard/analytics",
      "/dashboard/resume/improve",
      "/dashboard/interview/sample-frontend/report",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        /Mockmate Pro|Upgrade to Pro|Coding Rounds|Your next chapter starts here|A little practice. A lot more confidence.|Start a session/,
      );
      await expect(
        page.locator('a[href="/pricing"], a[href^="/dashboard/coding"]'),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width < 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("dialog")).not.toContainText(
        /Your next chapter|Start a session|Coding|Pro exclusive/,
      );
      await expect(
        page
          .getByRole("navigation", { name: "Application navigation" })
          .getByRole("link"),
      ).toHaveCount(5);
      await page.keyboard.press("Escape");
    }
  }
  for (const route of ["/dashboard/coding", "/dashboard/coding/old-round"]) {
    expect((await page.goto(route))?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Let’s get you back on track." }),
    ).toBeVisible();
  }
});

for (const plan of ["free", "pro"]) {
  test(`legacy ${plan} browser data preserves records and drops retired fields`, async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("Welcome back");
    await page.goto("/dashboard/interview/setup");
    await page.getByRole("button", { name: "Start my practice" }).click();
    await expect(page).toHaveURL(/interview-room\/demo-/);
    const room = page.url();
    await page
      .getByLabel("Your interview answer")
      .fill("A saved answer with concrete decisions and outcomes.");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("mockmate-demo-v1")))
      .toContain("A saved answer");
    const retained = await page.evaluate((plan) => {
      const data = JSON.parse(localStorage.getItem("mockmate-demo-v1")!);
      data.state.profile.name = "Legacy Member";
      data.state.preferences.reminders = false;
      data.state.resumes = [
        {
          id: "old-resume",
          name: "old.pdf",
          size: 123,
          date: new Date().toISOString(),
          analysis: {
            score: 80,
            skills: [],
            strengths: ["Clear"],
            improvements: ["Add impact"],
          },
        },
      ];
      const retained = { ...data.state };
      data.state.plan = plan;
      data.state.codingRounds = [{ corruptRetiredDraft: true }];
      localStorage.setItem("mockmate-demo-v1", JSON.stringify(data));
      return retained;
    }, plan);
    await page.reload();
    await expect(page.getByLabel("Your interview answer")).toHaveValue(
      "A saved answer with concrete decisions and outcomes.",
    );
    const migrated = await page.evaluate(
      () => JSON.parse(localStorage.getItem("mockmate-demo-v1")!).state,
    );
    expect(migrated).toEqual(retained);
    expect(migrated).not.toHaveProperty("plan");
    expect(migrated).not.toHaveProperty("codingRounds");
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("Legacy");
    await page.goto("/dashboard/resume");
    await page.getByRole("tab", { name: /Resume history/ }).click();
    await expect(page.getByRole("cell", { name: /old.pdf/ })).toBeVisible();
    await page.goto(room);
    await expect(page.getByLabel("Your interview answer")).toHaveValue(
      "A saved answer with concrete decisions and outcomes.",
    );
  });
}

test("ordinary demo usage limit preserves saved sessions and reports", async ({
  page,
}) => {
  await page.goto("/dashboard/interview/setup");
  await page.getByRole("button", { name: "Start my practice" }).click();
  await expect(page).toHaveURL(/interview-room\/demo-/);
  await page.evaluate((limit) => {
    const data = JSON.parse(localStorage.getItem("mockmate-demo-v1")!);
    const session = data.state.sessions[0];
    data.state.usage = { startedAt: Date.now(), resumes: 0, interviews: limit };
    data.state.sessions = Array.from({ length: limit }, (_, i) => ({
      ...session,
      id: `retained-${i}`,
    }));
    localStorage.setItem("mockmate-demo-v1", JSON.stringify(data));
  }, DEMO_INTERVIEW_LIMIT);
  await page.goto("/dashboard/interview/setup");
  await expect(
    page.getByRole("heading", {
      name: `Your ${DEMO_INTERVIEW_LIMIT} interview sessions are used.`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start my practice" }),
  ).toHaveCount(0);
  await page.goto("/dashboard/interview/sample-frontend/report");
  await expect(
    page.getByRole("heading", { name: "One question at a time" }),
  ).toBeVisible();
  await expect(
    page.getByText("PRACTICE GUIDANCE · NOT AI EVALUATION").first(),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export demo report" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("mockmate-demo-report.json");
  const data = JSON.parse(await readFile((await exported.path())!, "utf8"));
  expect(data.report).toEqual(mockReport);
});
