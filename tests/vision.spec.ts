import { test, expect } from "@playwright/test";
import { fixtureDetector, deviceCheck } from "./spoken-helpers";

test("optional phone checks require consent, confirm repeated samples and stop when disabled", async ({
  page,
}) => {
  test.setTimeout(65000);
  await fixtureDetector(page, 1);
  let uploads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/vision-checks")) uploads++;
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("account1@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/interview/setup");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to device checks" }).click();
  const optIn = page.getByRole("checkbox", {
    name: /Enable optional AI phone-visibility checks/,
  });
  await expect(optIn).toBeEnabled();
  expect(uploads).toBe(0);
  await optIn.check();
  await deviceCheck(page);
  const panel = page.getByRole("region", {
    name: "AI phone visibility checks",
  });
  await expect(panel).toContainText("Phone visible in the latest sample", {
    timeout: 15000,
  });
  await expect(panel).toContainText(
    "Phone visible on repeated camera samples",
    { timeout: 30000 },
  );
  expect(uploads).toBe(2);
  await panel.getByRole("button", { name: "Turn off image checks" }).click();
  await expect(panel).toHaveCount(0);
  const before = uploads;
  await page
    .getByRole("button", { name: "Complete interview", exact: true })
    .click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(
    page.getByRole("heading", {
      name: "Optional AI phone-visibility observations",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/2 sample\(s\).*1 repeated-detection episode/),
  ).toBeVisible();
  expect(uploads).toBe(before);
});

async function startOptionalChecks(page: import("@playwright/test").Page) {
  await fixtureDetector(page, 1);
  await page.goto("/login");
  await page.getByLabel("Email address").fill("account1@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/interview/setup");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to device checks" }).click();
  await page
    .getByRole("checkbox", {
      name: /Enable optional AI phone-visibility checks/,
    })
    .check();
  await deviceCheck(page);
}

test("withdrawal during a delayed image response ignores the late finding", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let uploads = 0;
  await page.route("**/vision-checks", async (route) => {
    uploads++;
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await startOptionalChecks(page);
    const panel = page.getByRole("region", {
      name: "AI phone visibility checks",
    });
    await expect(panel).toContainText(
      "Checking a sampled camera image with Groq",
    );
    await expect.poll(() => uploads).toBe(1);
    await panel.getByRole("button", { name: "Turn off image checks" }).click();
    await expect(panel).toHaveCount(0);
    release();
    await page.clock.install();
    await page.clock.fastForward(22000);
    await expect(
      page.getByText(/Phone visible in the latest sample/),
    ).toHaveCount(0);
    expect(uploads).toBe(1);
    await page
      .getByRole("button", { name: "Complete interview", exact: true })
      .click();
    await expect(page).toHaveURL(/\/report$/);
  } finally {
    release();
  }
});

test("optional provider failure leaves spoken answer submission available", async ({
  page,
}) => {
  await page.route("**/vision-checks", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "vision_unavailable",
          message: "Optional provider unavailable.",
        },
      }),
    }),
  );
  await startOptionalChecks(page);
  await expect(
    page.getByRole("region", { name: "AI phone visibility checks" }),
  ).toContainText("Optional provider unavailable");
  await page
    .getByRole("button", { name: "Start answering", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Stop & transcribe answer.*2s/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Stop & transcribe answer/ }).click();
  await expect(page.getByLabel("Review transcript")).not.toHaveValue("", {
    timeout: 20000,
  });
  await page
    .getByRole("button", { name: "Submit answer & next question", exact: true })
    .click();
  await expect(page.getByText(/^Question 2 of /)).toBeVisible();
  await page
    .getByRole("button", { name: "Complete interview", exact: true })
    .click();
  await expect(page).toHaveURL(/\/report$/);
});
