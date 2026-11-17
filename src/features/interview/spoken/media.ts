"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function recordingType() {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t)) ?? null
  );
}
export function mediaError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (["NotAllowedError", "SecurityError"].includes(name))
    return "Camera or microphone permission denied. Allow both in your browser site settings, then retry.";
  if (name === "NotFoundError")
    return "Camera or microphone not found. Connect both devices and retry.";
  if (["NotReadableError", "AbortError"].includes(name))
    return "A device may be in use by another app or disconnected. Close the other app and retry.";
  if (name === "OverconstrainedError")
    return "The selected device is no longer available. Select another device and retry.";
  return error instanceof Error
    ? error.message
    : "Unable to open camera and microphone. Retry device checks.";
}

export function useCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const current = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
    current.current?.getTracks().forEach((t) => t.stop());
    current.current = null;
    setStream(null);
  }, []);
  const open = useCallback(
    async (camera = "", mic = "") => {
      stop();
      const ticket = generation.current;
      setError("");
      try {
        if (!navigator.mediaDevices?.getUserMedia || !recordingType())
          throw new Error(
            "This browser cannot record a supported audio format. Use a current Chrome, Edge, Firefox or Safari over HTTPS.",
          );
        const next = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            ...(camera ? { deviceId: { exact: camera } } : {}),
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            ...(mic ? { deviceId: { exact: mic } } : {}),
          },
        });
        if (generation.current !== ticket) {
          next.getTracks().forEach((t) => t.stop());
          return;
        }
        current.current = next;
        setStream(next);
        setDevices(await navigator.mediaDevices.enumerateDevices());
      } catch (e) {
        if (generation.current === ticket) setError(mediaError(e));
      }
    },
    [stop],
  );
  useEffect(
    () => () => {
      generation.current++;
      current.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!stream) return;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      setLevel(
        Math.min(
          100,
          Math.sqrt(
            data.reduce((s, v) => s + ((v - 128) / 128) ** 2, 0) / data.length,
          ) * 400,
        ),
      );
    }, 150);
    void context.resume();
    return () => {
      clearInterval(timer);
      source.disconnect();
      void context.close();
    };
  }, [stream]);
  return { stream, devices, level, error, open, stop };
}

export function useFaceDetector(
  stream: MediaStream | null,
  video: React.RefObject<HTMLVideoElement | null>,
  sampleMs: number,
  modelPath = "/mediapipe/blaze_face_short_range.tflite",
  minConfidence = 0.6,
  phoneLocal = false,
) {
  const [status, setStatus] = useState("Not initialized");
  const [faces, setFaces] = useState<number | null>(null);
  const lastInference = useRef(0);
  const [phone, setPhone] = useState({
    ready: false,
    candidate: false,
    at: 0,
    error: false,
  });
  useEffect(() => {
    if (!stream) return;
    let worker: Worker;
    let disposed = false,
      inFlight = false,
      available = false,
      lastFrame = 0,
      lastVideoTime = -1;
    const reset = () => {
      lastInference.current = 0;
      setStatus("Loading local face detector…");
      setFaces(null);
      setPhone({ ready: false, candidate: false, at: 0, error: false });
    };
    reset();
    try {
      worker = new Worker("/mediapipe/face-worker.js");
    } catch {
      queueMicrotask(() => {
        if (!disposed) setStatus("Face detection unavailable in this browser.");
      });
      return;
    }
    const fail = () => {
      available = false;
      inFlight = false;
      setFaces(null);
      setStatus("Face detection unavailable. Retry device checks.");
    };
    worker.onerror = fail;
    worker.onmessage = ({ data }) => {
      if (disposed) return;
      if (data.type === "ready") {
        available = true;
        setStatus("Checking camera frames…");
      }
      if (data.type === "faces") {
        lastInference.current = performance.now();
        inFlight = false;
        setFaces(data.count);
        setStatus("Ready");
      }
      if (data.type === "error") fail();
      if (data.type === "phone_ready")
        setPhone({
          ready: true,
          candidate: false,
          at: performance.now(),
          error: false,
        });
      if (data.type === "phone_candidate")
        setPhone({
          ready: true,
          candidate: data.candidate,
          at: performance.now(),
          error: false,
        });
      if (data.type === "phone_error")
        setPhone({ ready: false, candidate: false, at: 0, error: true });
    };
    worker.postMessage({ type: "init", modelPath, minConfidence, phoneLocal });
    const loadingTimeout = setTimeout(() => {
      if (!available) fail();
    }, 20000);
    const timer = setInterval(
      async () => {
        if (document.hidden) return;
        if (inFlight && performance.now() - lastFrame > 5000) {
          fail();
          return;
        }
        if (
          available &&
          lastInference.current &&
          performance.now() - lastInference.current > 5000
        ) {
          fail();
          return;
        }
        if (
          !available ||
          disposed ||
          inFlight ||
          document.hidden ||
          !video.current ||
          video.current.readyState < 2 ||
          video.current.currentTime === lastVideoTime
        )
          return;
        inFlight = true;
        lastVideoTime = video.current.currentTime;
        lastFrame = performance.now();
        try {
          const frame = await createImageBitmap(video.current, {
            resizeWidth: phoneLocal ? 640 : 320,
          });
          if (disposed) {
            frame.close();
            return;
          }
          worker.postMessage({ type: "frame", frame, at: performance.now() }, [
            frame,
          ]);
        } catch {
          fail();
        }
      },
      Math.max(500, sampleMs),
    );
    const visibility = () => {
      lastFrame = performance.now();
      lastVideoTime = -1;
      lastInference.current = 0;
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      clearInterval(timer);
      clearTimeout(loadingTimeout);
      document.removeEventListener("visibilitychange", visibility);
      worker.terminate();
    };
  }, [stream, video, sampleMs, modelPath, minConfidence, phoneLocal]);
  return {
    ready: !!stream && status === "Ready",
    status,
    faces,
    lastInference,
    phone,
  };
}
