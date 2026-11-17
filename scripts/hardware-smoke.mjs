// Real devices only: no fake-device flags, no saved media, no external audio request.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("public");
const server = createServer(async (req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>Local device check</title>");
    return;
  }
  const file = path.resolve(
    root,
    "." + new URL(req.url, "http://localhost").pathname,
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const body = await readFile(file);
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".wasm")
          ? "application/wasm"
          : "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(3112, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext();
  await context.grantPermissions(["camera", "microphone"], {
    origin: "http://127.0.0.1:3112",
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3112");
  if (process.argv.length > 2) {
    const images = await Promise.all(
      process.argv
        .slice(2)
        .map(async (file) => ({
          name: path.basename(file),
          data:
            "data:image/jpeg;base64," +
            (await readFile(file)).toString("base64"),
        })),
    );
    const result = await page.evaluate(async (inputs) => {
      const worker = new Worker("/mediapipe/face-worker.js");
      try {
        return await new Promise((resolve, reject) => {
          const results = [];
          let index = 0;
          const timeout = setTimeout(
            () => reject(new Error("Object detector timeout")),
            20000,
          );
          const send = async () => {
            const frame = await createImageBitmap(
              await (await fetch(inputs[index].data)).blob(),
            );
            worker.postMessage(
              { type: "frame", frame, at: (index + 1) * 3000 },
              [frame],
            );
          };
          worker.onmessage = ({ data }) => {
            if (data.type === "phone_ready") void send();
            if (data.type === "phone_error" || data.type === "error") {
              clearTimeout(timeout);
              reject(new Error("Detector unavailable"));
            }
            if (data.type === "phone_candidate") {
              results.push({
                name: inputs[index].name,
                candidate: data.candidate,
              });
              if (++index === inputs.length) {
                clearTimeout(timeout);
                resolve(results);
              } else void send();
            }
          };
          worker.postMessage({ type: "init", phoneLocal: true });
        });
      } finally {
        worker.terminate();
      }
    }, images);
    console.log(JSON.stringify(result));
  } else {
    const result = await page.evaluate(async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput").length;
      const microphones = devices.filter((d) => d.kind === "audioinput").length;
      if (!cameras || !microphones)
        return {
          verified: false,
          cameras,
          microphones,
          reason:
            "Physical camera and microphone are not both exposed to this browser.",
        };
      let stream, worker;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 } },
          audio: true,
        });
        const video = document.createElement("video");
        video.muted = true;
        video.srcObject = stream;
        await video.play();
        worker = new Worker("/mediapipe/face-worker.js");
        const frames = await new Promise((resolve, reject) => {
          let count = 0;
          const timeout = setTimeout(
            () => reject(new Error("Detector timeout")),
            20000,
          );
          const send = async () => {
            const frame = await createImageBitmap(video, { resizeWidth: 320 });
            worker.postMessage(
              { type: "frame", frame, at: performance.now() },
              [frame],
            );
          };
          worker.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Detector failed"));
          };
          worker.onmessage = ({ data }) => {
            if (data.type === "ready") void send();
            if (data.type === "error") {
              clearTimeout(timeout);
              reject(new Error("Detector unavailable"));
            }
            if (data.type === "faces") {
              if (++count === 5) {
                clearTimeout(timeout);
                resolve(count);
              } else setTimeout(() => void send(), 750);
            }
          };
          worker.postMessage({ type: "init" });
        });
        return {
          verified: true,
          cameras,
          microphones,
          frames,
          microphoneLive: stream.getAudioTracks()[0].readyState === "live",
        };
      } catch (error) {
        return {
          verified: false,
          cameras,
          microphones,
          reason: error.name || "Device check failed",
        };
      } finally {
        stream?.getTracks().forEach((track) => track.stop());
        worker?.terminate();
      }
    });
    console.log(JSON.stringify(result));
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
