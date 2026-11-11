// Reproduce self-hosted Apache-2.0 MediaPipe runtime assets from the locked package.
import { mkdir, copyFile, readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const target = "public/mediapipe/runtime";
await mkdir(`${target}/wasm`, { recursive: true });
await copyFile(
  "node_modules/@mediapipe/tasks-vision/vision_bundle.cjs",
  `${target}/vision_bundle.js`,
);
for (const name of await readdir("node_modules/@mediapipe/tasks-vision/wasm")) {
  await copyFile(
    `node_modules/@mediapipe/tasks-vision/wasm/${name}`,
    `${target}/wasm/${name}`,
  );
}
const model = await readFile("public/mediapipe/blaze_face_short_range.tflite");
const expected =
  "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f";
if (createHash("sha256").update(model).digest("hex") !== expected)
  throw new Error("Face model checksum mismatch");
const phoneModel = await readFile("public/mediapipe/efficientdet_lite0.tflite");
if (
  createHash("sha256").update(phoneModel).digest("hex") !==
  "0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb"
)
  throw new Error("Object detector model checksum mismatch");
