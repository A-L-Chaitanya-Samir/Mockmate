// Explicitly authorized, human-operated physical acceptance. No fake devices,
// no saved audio/images, no traces, and credentials arrive over stdin only.
import { chromium } from "@playwright/test";
let input = "";
for await (const part of process.stdin) input += part;
const credentials = JSON.parse(input);
const browser = await chromium.launch({ channel: "chrome", headless: false });
const evidence = {
  kind: "physical_interview",
  started_at: new Date().toISOString(),
  synthetic_admin_confirmed_account: true,
  email_delivery_verified: false,
  transcription_uploads: 0,
  submitted_answers: 0,
  vision_uploads: 0,
  report_refreshed: false,
  report_second_context: false,
};
const timeout = setTimeout(
  () => {
    void browser.close();
  },
  30 * 60 * 1000,
);
process.on("SIGINT", () => {
  void browser.close();
});
try {
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    window.__physicalStreams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      window.__physicalStreams.push(stream);
      return stream;
    };
  });
  const page = await context.newPage();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (response.request().method() !== "POST" || !response.ok()) return;
    if (url.pathname.endsWith("/transcriptions"))
      evidence.transcription_uploads++;
    if (url.pathname.endsWith("/answers")) evidence.submitted_answers++;
    if (url.pathname.endsWith("/vision-checks")) evidence.vision_uploads++;
  });
  async function login(target) {
    await target.goto("http://localhost:3000/login");
    await target.getByLabel("Email address").fill(credentials.email);
    await target
      .getByLabel("Password", { exact: true })
      .fill(credentials.password);
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await target.waitForURL("**/dashboard");
  }
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    const match = frame.url().match(/\/interview-room\/([^/?]+)/);
    if (match) {
      evidence.session_id = match[1];
      evidence.phase = "human_spoken_journey";
    }
  });
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (!response.ok() || response.request().method() !== "GET") return;
    try {
      if (/\/api\/v1\/resumes\/[^/]+$/.test(url.pathname)) {
        const value = await response.json();
        if (value.status === "ready") evidence.resume_analysis_verified = true;
      }
      if (/\/api\/v1\/interviews\/[^/]+$/.test(url.pathname)) {
        const value = await response.json();
        const ready = (value.transcriptions || []).filter(
          (t) => t.status === "ready",
        );
        if (ready.length) {
          evidence.ready_transcriptions = ready.length;
          evidence.transcription_model = ready[0].model;
        }
      }
    } catch {
      /* Only bounded metadata is recorded; never response contents. */
    }
  });
  await login(page);
  await page.goto("http://localhost:3000/dashboard/resume");
  await page
    .locator("input[type=file]")
    .setInputFiles("backend/tests/fixtures/synthetic-resume.pdf");
  await page
    .getByLabel("Target role (optional)", { exact: true })
    .fill("Python Backend Engineer");
  evidence.phase = "human_resume_setup";
  console.log(
    "READY: The visible Chrome window has a non-sensitive sample PDF selected. You control all remaining steps: analyze it, open interview setup, choose settings, continue through device checks, record/listen to the audio test, answer aloud and submit each transcript, then complete the interview. The helper now only observes until you open the saved report; it will not navigate away during your work.",
  );
  await page.waitForURL("**/dashboard/interview/*/report", {
    timeout: 28 * 60 * 1000,
  });
  const reportUrl = page.url();
  await page
    .getByRole("button", { name: "Export report & history" })
    .waitFor({ timeout: 180000 });
  evidence.physical_tracks = await page.evaluate(() =>
    (window.__physicalStreams || []).flatMap((stream) =>
      stream.getTracks().map((track) => ({
        kind: track.kind,
        label: track.label,
        state: track.readyState,
      })),
    ),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Export report & history" })
    .waitFor({ timeout: 45000 });
  evidence.report_refreshed = true;
  const other = await browser.newContext();
  const second = await other.newPage();
  await login(second);
  await second.goto(reportUrl);
  await second
    .getByRole("button", { name: "Export report & history" })
    .waitFor({ timeout: 45000 });
  evidence.report_second_context = true;
  evidence.completed_at = new Date().toISOString();
  console.log("RESULT: " + JSON.stringify(evidence));
} catch (error) {
  evidence.incomplete = true;
  evidence.reason =
    error.name === "TimeoutError"
      ? "Human journey or processing timed out"
      : "Guided test interrupted; inspect local application";
  console.log("RESULT: " + JSON.stringify(evidence));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await browser.close();
}
