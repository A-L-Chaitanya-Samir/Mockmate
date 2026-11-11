/* MediaPipe inference stays in this worker; no image ever leaves the browser. */
self.exports = {};
let detector, phoneDetector;
let lastPhoneAt = 0;
self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      importScripts("/mediapipe/runtime/vision_bundle.js");
      const vision = await self.exports.FilesetResolver.forVisionTasks(
        "/mediapipe/runtime/wasm",
      );
      detector = await self.exports.FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            data.modelPath || "/mediapipe/blaze_face_short_range.tflite",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        minDetectionConfidence: data.minConfidence || 0.6,
      });
      self.postMessage({ type: "ready" });
      if (data.phoneLocal) {
        try {
          phoneDetector = await self.exports.ObjectDetector.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath: "/mediapipe/efficientdet_lite0.tflite",
                delegate: "CPU",
              },
              runningMode: "VIDEO",
              scoreThreshold: 0.3,
              maxResults: 2,
              categoryAllowlist: ["cell phone"],
            },
          );
          self.postMessage({ type: "phone_ready" });
        } catch {
          self.postMessage({ type: "phone_error" });
        }
      }
    } catch {
      self.postMessage({
        type: "error",
        message: "Face detector could not load. Retry device checks.",
      });
    }
  } else if (data.type === "frame") {
    try {
      const result = detector.detectForVideo(data.frame, data.at);
      self.postMessage({ type: "faces", count: result.detections.length });
      if (phoneDetector && data.at - lastPhoneAt >= 2000) {
        lastPhoneAt = data.at;
        try {
          const phones = phoneDetector.detectForVideo(data.frame, data.at);
          self.postMessage({
            type: "phone_candidate",
            candidate: phones.detections.length > 0,
          });
        } catch {
          phoneDetector = null;
          self.postMessage({ type: "phone_error" });
        }
      }
    } catch {
      self.postMessage({
        type: "error",
        message: "Face detection unavailable. Retry device checks.",
      });
    } finally {
      data.frame.close();
    }
  }
};
