import { test, expect } from "@playwright/test";
import {
  Episodes,
  type Event,
} from "../src/features/interview/spoken/observations";
import { fixtureDetector, deviceCheck } from "./spoken-helpers";

test("face episodes require sustained observations, recovery and cooldown", () => {
  const events: Event[] = [];
  const engine = new Episodes(
    { sustain_ms: 4000, recovery_ms: 2000, cooldown_ms: 10000, sample_ms: 750 },
    (event) => events.push(event),
  );
  for (let now = 0; now < 4000; now += 500) engine.sample("no_face", true, now);
  expect(events).toHaveLength(0);
  engine.sample("no_face", true, 4000);
  for (let now = 4500; now < 7000; now += 500)
    engine.sample("no_face", true, now);
  expect(events).toHaveLength(1);
  for (let now = 7000; now <= 9000; now += 500)
    engine.sample("no_face", false, now);
  expect(events).toHaveLength(2);
  expect(events[1].episode_id).toBe(events[0].episode_id);
  for (let now = 9500; now < 19000; now += 500)
    engine.sample("no_face", true, now);
  expect(events).toHaveLength(2);
  engine.sample("no_face", true, 19000);
  expect(events).toHaveLength(3);
});

test("quick visibility changes are recorded without waiting for background timers", () => {
  const events: Event[] = [];
  const engine = new Episodes(
    { sustain_ms: 4000, recovery_ms: 2000, cooldown_ms: 10000, sample_ms: 750 },
    (e) => events.push(e),
  );
  engine.sample("tab_hidden", true, 0, true);
  engine.sample("tab_hidden", false, 100, true);
  engine.sample("tab_hidden", true, 200, true);
  engine.sample("tab_hidden", false, 300, true);
  expect(events.filter((e) => e.phase === "start")).toHaveLength(2);
  expect(
    events.filter((e) => e.phase === "recovered").map((e) => e.duration_ms),
  ).toEqual([100, 100]);
});

test("a real quick browser tab switch remains visible on return", async ({
  playwright,
}) => {
  // Normal Playwright pages force visibility/focus. Use the browser's default
  // context over CDP without those overrides to exercise real tab transitions.
  // Full Chromium's new headless mode has browser tabs; the default headless
  // shell used on CI does not reproduce their visibility transitions.
  const host = await playwright.chromium.launchServer({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chromium",
    args: [
      "--remote-debugging-port=9223",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  let browser;
  try {
    browser = await playwright.chromium.connectOverCDP(
      "http://127.0.0.1:9223",
      { noDefaults: true },
    );
    const context = browser.contexts()[0];
    const page = await context.newPage();
    await fixtureDetector(page, 1);
    await newSpoken(page);
    await deviceCheck(page);
    const other = await context.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
    await page.bringToFront();
    await expect(
      page.getByText("Tab switches this visit: 1", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Returned to the interview tab. A tab switch was recorded.",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await browser?.close();
    await host.close();
  }
});

test("actual bundled MediaPipe worker loads and detects a blank frame locally", async ({
  page,
}) => {
  await page.goto("/login");
  const result = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const worker = new Worker("/mediapipe/face-worker.js");
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error("Detector initialization timeout"));
        }, 25000);
        worker.onerror = () => {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error("Worker failed"));
        };
        worker.onmessage = async ({ data }) => {
          if (data.type === "ready") {
            const canvas = new OffscreenCanvas(320, 240);
            const context = canvas.getContext("2d")!;
            context.fillStyle = "black";
            context.fillRect(0, 0, 320, 240);
            const frame = canvas.transferToImageBitmap();
            worker.postMessage(
              { type: "frame", frame, at: performance.now() },
              [frame],
            );
          }
          if (data.type === "faces" || data.type === "error") {
            clearTimeout(timeout);
            worker.terminate();
            resolve(data.type === "faces" ? String(data.count) : data.message);
          }
        };
        worker.postMessage({ type: "init" });
      }),
  );
  expect(result).toBe("0");
});

async function newSpoken(page: import("@playwright/test").Page) {
  await page.goto(
    new URL(
      "/login",
      process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100",
    ).href,
  );
  await page.getByLabel("Email address").fill("account1@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(
    new URL(
      "/dashboard/interview/setup",
      process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100",
    ).href,
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to device checks" }).click();
  await expect(page).toHaveURL(/\/interview-room\//);
}

test("denied devices and detector failures block spoken interviews", async ({
  page,
}) => {
  await newSpoken(page);
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page
    .getByRole("button", { name: "Enable / retry selected devices" })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "permission denied",
  );
  await expect(
    page.getByRole("button", { name: "Start camera-on interview" }),
  ).toBeDisabled();
  for (const [name, message] of [
    ["NotFoundError", "not found"],
    ["NotReadableError", "in use by another app"],
    ["OverconstrainedError", "no longer available"],
  ]) {
    await page.evaluate((errorName) => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("device unavailable", errorName);
      };
    }, name);
    await page
      .getByRole("button", { name: "Enable / retry selected devices" })
      .click();
    await expect(page.locator("p[role=alert]")).toContainText(message);
  }
  await page.reload();
  await page.route("**/mediapipe/face-worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage=()=>self.postMessage({type:'error'});",
    }),
  );
  await page
    .getByRole("button", { name: "Enable / retry selected devices" })
    .click();
  await expect(
    page.getByText(/Face detector: Face detection unavailable/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start camera-on interview" }),
  ).toBeDisabled();
});

test("multiple-face deterministic adapter yields bounded event episodes", () => {
  const events: Event[] = [];
  const engine = new Episodes(
    { sustain_ms: 4000, recovery_ms: 2000, cooldown_ms: 10000, sample_ms: 750 },
    (e) => events.push(e),
  );
  for (let now = 0; now < 10000; now += 500)
    engine.sample("multiple_faces", true, now);
  expect(events).toHaveLength(1);
  expect(events[0].kind).toBe("multiple_faces");
});

test("unsupported recording formats fail before opening the camera", async ({
  page,
}) => {
  await fixtureDetector(page);
  await newSpoken(page);
  await page.evaluate(() => {
    MediaRecorder.isTypeSupported = () => false;
  });
  await page
    .getByRole("button", { name: "Enable / retry selected devices" })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "cannot record a supported audio format",
  );
});

test("observation retries, tab coalescing, playback exclusion and media cleanup", async ({
  page,
}) => {
  await fixtureDetector(page, 0);
  let uploads = 0;
  await page.route("**/interviews/*/observations", async (route) => {
    if (++uploads === 1) await route.abort("internetdisconnected");
    else await route.continue();
  });
  await newSpoken(page);
  await deviceCheck(page);
  await page.evaluate(() => {
    (window as unknown as { testTracks: MediaStreamTrack[] }).testTracks = (
      document.querySelector("video")!.srcObject as MediaStream
    ).getTracks();
    const synth = {
      speaking: false,
      cancel() {
        this.speaking = false;
      },
      speak() {
        this.speaking = true;
      },
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: synth,
    });
  });
  await page.getByRole("button", { name: "Hear question" }).click();
  await expect(
    page.getByRole("button", { name: "Start answering" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Stop question playback" }).click();
  await expect(
    page.getByRole("button", { name: "Start answering" }),
  ).toBeEnabled();
  await expect(
    page.getByText("No face detected. Please return to the camera.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Observations waiting for network/),
  ).toBeVisible();
  await expect.poll(() => uploads).toBeGreaterThan(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("blur"));
  });
  await expect(
    page.getByText("Interview tab is no longer visible.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await page
    .getByRole("button", { name: "Complete interview", exact: true })
    .click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(
    page.getByRole("heading", { name: "Practice-integrity observations" }),
  ).toBeVisible();
  await expect(
    page.getByText("No face detected. Please return to the camera.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Interview window lost focus.", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { testTracks: MediaStreamTrack[] }
      ).testTracks.every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
});

test("frozen frames and ended device tracks produce availability warnings", async ({
  page,
}) => {
  await fixtureDetector(page, 1);
  await newSpoken(page);
  await deviceCheck(page);
  await page.evaluate(() => {
    const video = document.querySelector("video")!;
    const at = video.currentTime;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => at,
    });
  });
  await expect(
    page.getByText(
      "Face detection unavailable. Camera observations are interrupted.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("No face detected. Please return to the camera.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    (document.querySelector("video")!.srcObject as MediaStream)
      .getVideoTracks()[0]
      .stop(),
  );
  await expect(
    page.getByText("Camera disconnected.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (document.querySelector("video")!.srcObject as MediaStream)
      .getAudioTracks()[0]
      .stop(),
  );
  await expect(
    page.getByRole("region", { name: "Live practice observations" }),
  ).toContainText("Microphone unavailable or disconnected.");
});

for (const interruption of ["recorder-error", "microphone-ended"] as const) {
  test(`${interruption} discards partial audio without uploading an answer`, async ({
    page,
  }) => {
    await fixtureDetector(page, 1);
    await newSpoken(page);
    await deviceCheck(page);
    let uploads = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/transcriptions")
      )
        uploads++;
    });
    await page.evaluate(() => {
      const Native = window.MediaRecorder;
      window.MediaRecorder = class extends Native {
        constructor(stream: MediaStream, options?: MediaRecorderOptions) {
          super(stream, options);
          (
            window as unknown as { answerRecorder: MediaRecorder }
          ).answerRecorder = this;
        }
      };
    });
    await page
      .getByRole("button", { name: "Start answering", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Stop & transcribe answer.*2s/ }),
    ).toBeVisible();
    await page.evaluate((kind) => {
      if (kind === "recorder-error") {
        (
          window as unknown as { answerRecorder: MediaRecorder }
        ).answerRecorder.dispatchEvent(new Event("error"));
      } else {
        (document.querySelector("video")!.srcObject as MediaStream)
          .getAudioTracks()[0]
          .stop();
      }
    }, interruption);
    await expect(
      page.getByText(
        "Recording interrupted. Check the microphone and re-record.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Stop & transcribe answer/ }),
    ).toHaveCount(0);
    expect(uploads).toBe(0);
    await page
      .getByRole("button", { name: "Complete interview", exact: true })
      .click();
    await expect(page).toHaveURL(/\/report$/);
  });
}
