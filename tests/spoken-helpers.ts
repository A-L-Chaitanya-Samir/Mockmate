import { expect, type Page } from "@playwright/test";

export async function fixtureDetector(page: Page, count = 1) {
  await page.route("**/mediapipe/face-worker.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `self.onmessage=({data})=>{if(data.type==='init')self.postMessage({type:'ready'});else { data.frame.close();self.postMessage({type:'faces',count:${count}});}};`,
    }),
  );
}
export async function deviceCheck(page: Page) {
  await page
    .getByRole("button", { name: "Enable / retry selected devices" })
    .click();
  await expect(page.getByText(/Face detector: Ready/)).toBeVisible({
    timeout: 25000,
  });
  await expect(
    page.getByRole("button", { name: "Record audio test" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Record audio test" }).click();
  await expect(
    page.getByRole("button", { name: /Stop audio test \(2s\)/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Stop audio test/ }).click();
  await page
    .getByLabel("Review recorded audio")
    .evaluate(async (audio: HTMLAudioElement) => {
      audio.playbackRate = 4;
      await audio.play();
    });
  await expect(page.getByText("Audio test reviewed.")).toBeVisible();
  await page
    .getByRole("checkbox", { name: /^I agree to external transcription/ })
    .check();
  await page.getByRole("button", { name: "Start camera-on interview" }).click();
  await expect(
    page.getByRole("button", { name: "Start answering" }),
  ).toBeVisible();
}
