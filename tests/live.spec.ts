import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

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
  await login(page);
  await page.goto("/dashboard/interview/setup");
  await page
    .getByLabel("Target role", { exact: true })
    .fill("Browser Test Engineer");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Start interview", exact: true })
    .click();
  await expect(page).toHaveURL(/\/interview-room\//);
  await expect(page.getByLabel("Type your answer")).toBeVisible();
  const room = page.url();
  const answer =
    "I built a Python API with explicit transactions to preserve data consistency.";
  await page.getByLabel("Type your answer").fill(answer);
  await page
    .getByRole("button", { name: "Submit answer", exact: true })
    .click();
  await expect(page.getByText(answer, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(answer, { exact: true })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Complete interview", exact: true })
    .click();
  await expect(page).toHaveURL(/\/report$/);
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
      "/dashboard/coding",
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
  await page.getByRole("combobox", { name: "Default interview type", exact: true }).selectOption("Behavioral");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved.");
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Saved Member",
  );
  await expect(page.getByRole("combobox", { name: "Default interview type", exact: true })).toHaveValue("Behavioral");
  await page.goto("/dashboard/resume");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your story starts here." }),
  ).toBeVisible();
});
