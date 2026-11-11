import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fixtureDetector, deviceCheck } from "./spoken-helpers";

const viewports = [
  [320, 720],
  [360, 800],
  [390, 844],
  [430, 932],
  [600, 960],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
  [844, 390],
];

test("light and dark text/button tokens meet normal-text contrast", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toBeVisible();
  const results = await page.evaluate(() => {
    const values: { theme: string; pair: string; ratio: number }[] = [];
    const luminance = (hex: string) => {
      if (/^#[0-9a-f]{3}$/i.test(hex))
        hex = "#" + [...hex.slice(1)].map((c) => c + c).join("");
      const channels = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle("dark", dark);
      const css = getComputedStyle(document.documentElement);
      const token = (name: string) => css.getPropertyValue(`--${name}`).trim();
      const contrast = (a: string, b: string) => {
        const light = [luminance(a), luminance(b)].sort((x, y) => x - y);
        return (light[1] + 0.05) / (light[0] + 0.05);
      };
      for (const fg of ["foreground", "muted", "subtle", "primary"])
        for (const bg of ["background", "surface", "elevated"])
          values.push({
            theme: dark ? "dark" : "light",
            pair: `${fg}/${bg}`,
            ratio: contrast(token(fg), token(bg)),
          });
      values.push({
        theme: dark ? "dark" : "light",
        pair: "primary button",
        ratio: contrast(
          "#ffffff",
          dark ? token("primary-button") : token("primary"),
        ),
      });
    }
    return values;
  });
  for (const result of results)
    expect(
      result.ratio,
      `${result.theme} ${result.pair}`,
    ).toBeGreaterThanOrEqual(4.5);
});

test("public, workspace and interview layouts fit mobile through TV-sized viewports", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  const live = process.env.MOCKMATE_BROWSER_MODE === "live";
  const evidence: { route: string; width: number; height: number }[] = [];
  const artifactDir = `.test-deps/responsive-${live ? "live" : "demo"}-${process.env.PLAYWRIGHT_ENGINE || "chromium"}`;
  await mkdir(artifactDir, { recursive: true });
  const inspect = async (route: string) => {
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          { message: `${route}: no page overflow at ${width}x${height}` },
        )
        .toBe(true);
      await expect(page.locator("h1").first()).toBeVisible();
      if (["/register", "/dashboard/interview/setup"].includes(route)) {
        for (const input of await page
          .locator("input:not([type=checkbox]), select")
          .all()) {
          if (!(await input.isVisible())) continue;
          const bounds = await input.boundingBox();
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
          if (width < 768) expect(bounds!.height).toBeGreaterThanOrEqual(44);
        }
      }
      evidence.push({ route, width, height });
      if (
        [320, 820, 1920, 3840].includes(width) &&
        [
          "/register",
          "/dashboard",
          "/dashboard/interview/setup",
          "interview-room",
        ].includes(route)
      ) {
        await page.screenshot({
          path: `${artifactDir}/${route.replaceAll("/", "_")}-${width}.png`,
          animations: "disabled",
        });
      }
    }
  };
  for (const route of [
    "/",
    "/about",
    "/login",
    "/register",
    "/forgot-password",
  ]) {
    await page.goto(route);
    await inspect(route);
  }
  if (live) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("account1@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  for (const route of [
    "/dashboard",
    "/dashboard/analytics",
    "/dashboard/resume",
    "/dashboard/resume/improve",
    "/dashboard/interview",
    "/dashboard/interview/setup",
    "/dashboard/settings",
    "/dashboard/suggestions",
  ]) {
    await page.goto(route);
    await inspect(route);
  }
  if (!live) {
    await page.goto("/dashboard/interview/sample-frontend/report");
    await inspect("saved-report");
    await page.goto("/dashboard/interview/setup");
    await page.getByRole("button", { name: "Start my practice" }).click();
    await expect(page).toHaveURL(/interview-room\/demo-/);
  } else {
    await page.goto("/dashboard/interview");
    await expect(page.locator("h1").first()).toBeVisible();
    const report = page.locator('a[href$="/report"]').first();
    if (await report.count()) {
      await report.click();
      await inspect("saved-report");
    }
    await page.goto("/dashboard/interview/setup");
    await fixtureDetector(page, 1);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Continue to device checks" })
      .click();
    await expect(page).toHaveURL(/interview-room\//);
    await inspect("device-check");
    if (process.env.RESPONSIVE_LAYOUT_ONLY !== "1") await deviceCheck(page);
  }
  await inspect("interview-room");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest("[role=dialog]"),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  // Simulates 200% text sizing/reflow, not an actual smart-TV browser or screen reader.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await writeFile(
    `${artifactDir}/results.json`,
    JSON.stringify(
      {
        recorded_at: new Date().toISOString(),
        browser: browser.version(),
        mode: live ? "deterministic-live" : "demo",
        scope: `${process.env.PLAYWRIGHT_ENGINE || "chromium"} viewport emulation; ${process.env.RESPONSIVE_LAYOUT_ONLY === "1" ? "no media acquired" : "fake interview media"}; not physical mobile/TV acceptance`,
        checks: evidence,
      },
      null,
      2,
    ),
  );
});
