import { test, expect } from "@playwright/test";
test("desktop, tablet, and mobile interview compositions and keyboard drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex." }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/dashboard-desktop.png",
    fullPage: false,
    animations: "disabled",
  });
  await page.goto("/dashboard/interview/setup");
  await page.getByRole("button", { name: "Start my practice" }).click();
  await expect(page).toHaveURL(/\/interview-room\/demo-/);
  await page
    .getByLabel("Your interview answer")
    .fill(
      "I started by understanding the problem, compared the trade-offs, and tested a small solution before expanding it.",
    );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/interview-room-desktop.png",
    fullPage: false,
    animations: "disabled",
  });
  for (const width of [1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        { message: `Interview room at ${width}px` },
      )
      .toBe(true);
    await expect(page.getByLabel("Your interview answer")).toBeVisible();
  }
  await page.getByRole("button", { name: "Practice insights" }).click();
  await expect(
    page.getByRole("heading", { name: "Your performance preview" }),
  ).not.toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/interview-room-mobile.png",
    fullPage: false,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Switch color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/interview-room-mobile-light.png",
    fullPage: false,
    animations: "disabled",
  });
});
