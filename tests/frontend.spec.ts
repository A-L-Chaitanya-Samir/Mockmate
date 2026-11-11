import { test, expect } from "@playwright/test";
declare global {
  interface Window {
    testTracks: MediaStreamTrack[];
  }
}

const routes = [
  "/",
  "/about",
  "/pricing",
  "/login",
  "/register",
  "/forgot-password",
  "/dashboard",
  "/dashboard/resume",
  "/dashboard/resume/analyze",
  "/dashboard/resume/improve",
  "/dashboard/interview",
  "/dashboard/interview/setup",
  "/dashboard/analytics",
  "/dashboard/suggestions",
  "/dashboard/settings",
  "/dashboard/interview/sample-frontend/report",
];

test("every public/workspace route renders without browser errors or dead local links", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  const destinations = new Set<string>();
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveTitle(/Mockmate/);
    for (const href of await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")!)))
      destinations.add(href);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  for (const path of destinations)
    expect((await page.request.get(path)).status(), path).toBe(200);
  expect(errors).toEqual([]);
});

test("registration validates, creates a persisted demo profile, and never stores credentials", async ({
  page,
}) => {
  await page.goto("/register");
  await page
    .getByRole("button", { name: "Create demo profile", exact: true })
    .click();
  await expect(page.getByText("Enter at least 2 characters.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await page.getByLabel("Full name").fill("Taylor Demo");
  await page.getByLabel("Email address").fill("demo@example.test");
  await page
    .getByLabel("Demo password", { exact: true })
    .fill("invented-demo-123");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(
    page.getByLabel("Demo password", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create demo profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back, Taylor." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Taylor." }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    localStorage.getItem("mockmate-demo-v1"),
  );
  expect(saved).not.toContain("invented-demo-123");
  expect(saved).not.toContain("demo@example.test");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("login and forgot-password are explicit validated simulations", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await page
    .getByRole("button", { name: "Continue with demo account" })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("demo@example.test");
  await page.getByRole("button", { name: "Send demo reset request" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo request complete." }),
  ).toBeVisible();
  await expect(page.getByText(/No email was sent/)).toBeVisible();
});

test("interview setup through all questions, device fallback, reload, and report", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Test denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/dashboard/interview/setup?type=Behavioral");
  await page.getByLabel("Target job role").fill("a");
  await page.getByRole("button", { name: "Start my practice" }).click();
  await expect(
    page.getByText("Enter a role with at least 3 characters."),
  ).toBeVisible();
  await page.getByLabel("Target job role").fill("Demo Engineer");
  await page.getByRole("button", { name: "Start my practice" }).click();
  await expect(page).toHaveURL(/\/interview-room\/demo-/);
  const roomUrl = page.url();
  await expect(
    page.getByText(
      "Tell me about a time you worked through a disagreement with a teammate.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect(
    page.getByText(/Camera access is unavailable or was denied/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enable microphone", exact: true })
    .click();
  await expect(
    page.getByText(/Microphone access is unavailable or was denied/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Next question", exact: true })
    .click();
  await expect(page.getByText(/Add at least 10 characters/)).toBeVisible();
  await page
    .getByLabel("Your interview answer")
    .fill(
      "I clarified our shared goal, compared both approaches, and agreed on a small test to guide the decision.",
    );
  await page.reload();
  await expect(page.getByLabel("Your interview answer")).toHaveValue(
    /clarified our shared goal/,
  );
  for (let i = 0; i < 4; i++) {
    await page
      .getByLabel("Your interview answer")
      .fill(
        `Practice answer ${i + 1}: I explained the situation, took ownership, and described the outcome and what I learned.`,
      );
    await page
      .getByRole("button", {
        name: i === 3 ? "Finish practice" : "Next question",
        exact: true,
      })
      .click();
    if (i < 3)
      await expect(page.getByLabel("Your interview answer")).toHaveValue("");
  }
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep practicing" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "End interview", exact: true })
    .click();
  await page.getByRole("button", { name: "End & view report" }).click();
  await expect(page).toHaveURL(/\/dashboard\/interview\/demo-.*\/report/);
  await expect(
    page.getByRole("heading", { name: "You showed up. That’s progress." }),
  ).toBeVisible();
  await expect(page.getByText(/Practice answer 4:/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Practice answer 4:/)).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export demo report" }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(
    "mockmate-demo-report.json",
  );
  await page.goto("/dashboard/interview");
  await expect(page.getByText("Demo Engineer", { exact: true })).toBeVisible();
  await page.goto(roomUrl);
  await expect(
    page.getByRole("heading", { name: "You’ve wrapped up this session." }),
  ).toBeVisible();
});

test("camera preview and microphone tracks stop on interview end", async ({
  browser,
}) => {
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
    baseURL: test.info().project.use.baseURL,
  });
  await context.addInitScript(() => {
    const tracks: MediaStreamTrack[] = [];
    (window as Window & { testTracks: MediaStreamTrack[] }).testTracks = tracks;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  const page = await context.newPage();
  await page.goto("/dashboard/interview/setup");
  await page.getByRole("button", { name: "Start my practice" }).click();
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  // Browser uses fake media devices from the configured launch flags.
  await expect(page.getByLabel("Your local camera preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Enable microphone", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mute microphone", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Turn off camera", exact: true })
    .click();
  await expect(page.getByText("Camera is off")).toBeVisible();
  await page
    .getByRole("button", { name: "End interview", exact: true })
    .click();
  await page.getByRole("button", { name: "End & view report" }).click();
  await expect(page).toHaveURL(/\/report$/);
  expect(
    await page.evaluate(() =>
      (window as Window & { testTracks: MediaStreamTrack[] }).testTracks.every(
        (track) => track.readyState === "ended",
      ),
    ),
  ).toBe(true);
  await context.close();
});

test("resume file validation, simulated analysis, history persistence, and improvement export", async ({
  page,
}) => {
  await page.goto("/dashboard/resume/analyze");
  const input = page.getByLabel("Resume PDF");
  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByText("Choose a PDF file (.pdf).")).toBeVisible();
  await input.setInputFiles({
    name: "large.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(6 * 1024 * 1024),
  });
  await expect(
    page.getByText("Choose a non-empty PDF smaller than 5 MB."),
  ).toBeVisible();
  await input.setInputFiles({
    name: "sample-resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nDemo fixture, not a real resume."),
  });
  await expect(
    page.getByText("sample-resume.pdf", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run demo analysis" }).click();
  await expect(
    page.getByText("Demo analysis complete", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Resume history/ }).click();
  await expect(
    page.getByRole("cell", { name: /sample-resume.pdf/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Resume history/ }).click();
  await expect(
    page.getByRole("cell", { name: /sample-resume.pdf/ }),
  ).toBeVisible();
  await page.goto("/dashboard/resume/improve");
  await page.getByRole("button", { name: "Show sample improvement" }).click();
  await expect(
    page.getByText(/Designed and built a React application/),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download notes" }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(
    "mockmate-resume-notes.txt",
  );
});

test("settings profile, appearance, defaults, preferences and reset persist", async ({
  page,
}) => {
  await page.goto("/dashboard/settings");
  await page.getByLabel("Display name").fill("Demo Student");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Demo profile saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Demo Student");
  await page.getByRole("tab", { name: "Appearance" }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("tab", { name: "Preferences", exact: true }).click();
  await page.getByLabel("Practice reminders").uncheck();
  await page.getByLabel("Default interview type").selectOption("HR");
  await page.goto("/dashboard/interview/setup");
  await expect(
    page.getByRole("button", { name: "HR", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/dashboard/settings");
  await page.getByRole("tab", { name: "Preferences", exact: true }).click();
  await expect(page.getByLabel("Practice reminders")).not.toBeChecked();
  await page.getByRole("tab", { name: "Demo account" }).click();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset demo data", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex." }),
  ).toBeVisible();
});

test("mobile routes fit the viewport and navigation drawer works", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        { message: route },
      )
      .toBe(true);
  }
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Suggestions & Advice", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/suggestions$/);
});

test("unknown sessions and malformed stored state recover gracefully", async ({
  page,
}) => {
  await page.goto("/interview-room/not-a-session");
  await expect(
    page.getByRole("heading", { name: "This practice session isn’t here." }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem(
      "mockmate-demo-v1",
      '{"state":{"profile":null},"version":1}',
    ),
  );
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex." }),
  ).toBeVisible();
  const response = await page.goto("/not-a-real-route");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Let’s get you back on track." }),
  ).toBeVisible();
});
