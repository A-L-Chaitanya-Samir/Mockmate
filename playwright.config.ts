import { defineConfig, devices } from "@playwright/test";
const external = process.env.PLAYWRIGHT_BASE_URL;
const engine = process.env.PLAYWRIGHT_ENGINE || "chromium";
if (!["chromium", "firefox", "webkit"].includes(engine))
  throw new Error("Unsupported PLAYWRIGHT_ENGINE");
export default defineConfig({
  testDir: "./tests",
  testMatch:
    process.env.MOCKMATE_BROWSER_MODE === "live"
      ? /(?:live|spoken|vision|responsive)\.spec\.ts/
      : /(?:frontend|product-focus|visual|responsive)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: external || "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: engine,
      use: {
        ...devices[
          engine === "firefox"
            ? "Desktop Firefox"
            : engine === "webkit"
              ? "Desktop Safari"
              : "Desktop Chrome"
        ],
        ...(engine === "chromium"
          ? {
              ...(process.env.PLAYWRIGHT_CHANNEL
                ? { channel: process.env.PLAYWRIGHT_CHANNEL }
                : {}),
              launchOptions: {
                args: [
                  "--use-fake-device-for-media-stream",
                  "--use-fake-ui-for-media-stream",
                ],
              },
            }
          : {}),
      },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: "npm start -- --port 3100",
        url: "http://localhost:3100",
        reuseExistingServer: false,
        timeout: 120000,
      },
});
