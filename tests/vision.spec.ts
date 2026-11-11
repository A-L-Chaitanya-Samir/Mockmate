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
