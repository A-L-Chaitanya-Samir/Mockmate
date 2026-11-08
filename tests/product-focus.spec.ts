import { test, expect, type Page } from "@playwright/test";
import { plans } from "../src/config/plans";
async function enablePro(page: Page) {
  await page.goto("/pricing");
  await page
    .getByRole("button", { name: "Upgrade to Pro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No payment is collected",
  );
  await page
    .getByRole("button", { name: "Enable Pro demo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/coding$/);
}
async function startRound(page: Page) {
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Start coding interview", exact: true })
    .click();
  await expect(page.getByLabel("Code editor")).toBeVisible();
}
test("exactly two plans, no billing interval, and six core navigation destinations", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(
    page.getByTestId("pricing-plans").locator("section"),
  ).toHaveCount(2);
  await expect(page.getByTestId("plan-free")).toContainText("₹0");
  await expect(page.getByTestId("plan-pro")).toContainText("₹299");
  await expect(page.getByTestId("pricing-plans")).not.toContainText(
    /month|annual|year|enterprise|₹499|₹999/i,
  );
  await expect(
    page
      .getByRole("table", { name: "Free and Pro comparison" })
      .locator("tbody tr"),
  ).toHaveCount(8);
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Application navigation" });
  await expect(nav.getByRole("link")).toHaveCount(6);
  await expect(nav).toHaveText(
    /Dashboard.*Resume Analysis.*AI Interviews.*Coding Rounds.*Suggestions & Advice.*Settings/s,
  );
  for (const retired of [
    "/dashboard/learning-hub",
    "/dashboard/job-matching",
  ]) {
    const response = await page.goto(retired);
    expect(response?.status()).toBe(404);
  }
});
test("Free direct routes are gated; Pro upgrade and downgrade persist", async ({
  page,
}) => {
  await page.goto("/dashboard/coding");
  await expect(
    page.getByRole("heading", {
      name: "Your technical interview starts with Pro.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Code editor")).toHaveCount(0);
  await page.goto("/dashboard/resume/improve");
  await expect(
    page.getByRole("button", { name: "Show sample improvement" }),
  ).toHaveCount(0);
  await page.goto("/dashboard/interview/sample-frontend/report");
  await expect(page.getByText("Go deeper into your feedback.")).toBeVisible();
  await enablePro(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start coding interview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start coding interview" }),
  ).toBeDisabled();
  await page.goto("/dashboard/interview/sample-frontend/report");
  await expect(
    page.getByRole("img", { name: /Sample competencies/ }),
  ).toBeVisible();
  await page.goto("/dashboard/settings");
  await page.getByRole("tab", { name: "Demo account" }).click();
  await page.getByRole("button", { name: "Switch to Free demo" }).click();
  await page
    .getByRole("button", { name: "Use Free demo", exact: true })
    .click();
  await page.goto("/dashboard/coding");
  await expect(page.getByLabel("Code editor")).toHaveCount(0);
});
test("coding round supports editing, undo, language drafts, follow-ups, and simulated evaluation", async ({
  page,
}) => {
  await enablePro(page);
  await startRound(page);
  const editor = page.getByLabel("Code editor");
  await editor.press("Control+End");
  await editor.pressSequentially("// typed reasoning");
  await expect(editor).toHaveValue(/typed reasoning/);
  await editor.press("Control+Z");
  await expect(editor).not.toHaveValue(/typed reasoning/);
  await editor.fill(
    "function twoSum(nums, target) { return [0, 1]; }\n// practice implementation",
  );
  await editor.press("Control+A");
  await editor.press("Backspace");
  await expect(editor).toHaveValue("");
  await editor.pressSequentially(
    "// My approach uses a map to store earlier values.",
  );
  await page.getByLabel("Coding language").selectOption("Python");
  await expect(editor).toHaveValue(/def two_sum/);
  await page.getByLabel("Coding language").selectOption("JavaScript");
  await expect(editor).toHaveValue(
    "// My approach uses a map to store earlier values.",
  );
  await page
    .getByLabel("Your reasoning")
    .fill(
      "I chose a hash map so complement lookups are constant time on average.",
    );
  await page.getByRole("button", { name: "Next follow-up" }).click();
  await expect(
    page.getByText("What is its time and space complexity?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run demo", exact: true }).click();
  await expect(
    page.getByText(/SIMULATED RUN — no code was executed/),
  ).toBeVisible();
  await page.reload();
  await expect(editor).toHaveValue(
    "// My approach uses a map to store earlier values.",
  );
  await page
    .getByRole("button", { name: "Submit solution", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit & view sample feedback" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sample coding evaluation" }),
  ).toBeVisible();
  for (const name of [
    "Correctness",
    "Approach",
    "Complexity",
    "Problem-solving",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sample coding evaluation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "See coding suggestions" }).click();
  await page.getByRole("button", { name: "Coding", exact: true }).click();
  await expect(
    page.getByText("State an invariant before coding.", { exact: true }),
  ).toBeVisible();
});
test("clipboard, context menu, selection rules, and visibility events are transparent deterrents", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await enablePro(page);
  await startRound(page);
  const editor = page.getByLabel("Code editor");
  const original = await editor.inputValue();
  await page.evaluate(() =>
    navigator.clipboard.writeText("PREPARED SOLUTION MUST NOT APPEAR"),
  );
  await editor.focus();
  await editor.press("Control+V");
  await expect(editor).toHaveValue(original);
  await expect(page.getByTestId("integrity-count")).not.toHaveText("0");
  await editor.press("Control+A");
  await editor.press("Control+C");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "PREPARED SOLUTION MUST NOT APPEAR",
  );
  await editor.click({ button: "right" });
  await expect(
    page.getByText("Review suggested", { exact: true }),
  ).toBeVisible();
  const problem = page.getByRole("region", {
    name: "Coding problem statement",
  });
  await expect(problem).toHaveCSS("user-select", "none");
  await problem.dispatchEvent("copy", { bubbles: true, cancelable: true });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("list", { name: "Integrity events" }),
  ).toContainText("The coding interview tab was left or hidden.");
  await expect(page.getByText(/No automatic accusation/)).toBeVisible();
  const count = await page.getByTestId("integrity-count").textContent();
  await page.reload();
  expect(
    Number(await page.getByTestId("integrity-count").textContent()),
  ).toBeGreaterThanOrEqual(Number(count));
  await page.getByRole("button", { name: "End round", exact: true }).click();
  await page
    .getByRole("button", { name: "End without submission", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start another round" }),
  ).toBeVisible();
});
test("suggestions stay focused and adapt to resume, interview, and coding state", async ({
  page,
}) => {
  await page.goto("/dashboard/suggestions");
  await expect(
    page.getByRole("heading", { name: "Suggestions & Advice", exact: true }),
  ).toBeVisible();
  for (const category of [
    "Resume",
    "Interviews",
    "Communication",
    "Technical",
  ]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(
      page.locator("main section").filter({ has: page.locator("h2") }),
    ).not.toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "Coding", exact: true }),
  ).toHaveCount(0);
  await enablePro(page);
  await page.goto("/dashboard/suggestions");
  await expect(
    page.getByRole("button", { name: "Coding", exact: true }),
  ).toBeVisible();
});
test("central demo interview limits enforce creation without consuming sample history", async ({
  page,
}) => {
  await page.goto("/dashboard/interview/setup");
  for (let i = 0; i < plans.free.limits.interviews; i++) {
    await page.getByRole("button", { name: "Start my practice" }).click();
    await expect(page).toHaveURL(/\/interview-room\/demo-/);
    await page.goto("/dashboard/interview/setup");
  }
  await expect(
    page.getByRole("heading", {
      name: `Your ${plans.free.limits.interviews} interview sessions are used.`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start my practice" }),
  ).toHaveCount(0);
  await enablePro(page);
  await page.goto("/dashboard/interview/setup");
  await expect(
    page.getByText(
      new RegExp(
        `${plans.pro.limits.interviews - plans.free.limits.interviews} of ${plans.pro.limits.interviews} demo sessions remaining`,
      ),
    ),
  ).toBeVisible();
});
test("older stored profiles migrate without retaining retired learning progress", async ({
  page,
}) => {
  await page.goto("/dashboard/interview/setup");
  await page.getByRole("button", { name: "Start my practice" }).click();
  await expect(page).toHaveURL(/\/interview-room\/demo-/);
  await page.goto("/dashboard");
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("mockmate-demo-v1") || "null");
    data.state.profile.name = "Returning Student";
    data.state.completedLessons = ["react"];
    delete data.state.plan;
    delete data.state.codingRounds;
    localStorage.setItem("mockmate-demo-v1", JSON.stringify(data));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Returning." }),
  ).toBeVisible();
  await page.goto("/dashboard/coding");
  await expect(page.getByLabel("Code editor")).toHaveCount(0);
});
test("Pro coding environment fits mobile, tablet, and wide desktop layouts", async ({
  page,
}) => {
  await enablePro(page);
  await startRound(page);
  for (const width of [390, 768, 1024, 1680]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        { message: `Coding at ${width}px` },
      )
      .toBe(true);
    await expect(page.getByLabel("Code editor")).toBeVisible();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/coding-round-pro.png",
    animations: "disabled",
  });
});
