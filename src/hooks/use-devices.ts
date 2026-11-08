"use client";
import { useEffect, useRef, useState } from "react";
/** Streams are local previews only. Tracks stop on disable and route unmount. */
export function useDevices() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cameraStream.current?.getTracks().forEach((t) => t.stop());
      micStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = cameraStream.current;
  }, [camera]);
  async function toggle(kind: "camera" | "mic") {
    const active = kind === "camera" ? camera : mic;
    const ref = kind === "camera" ? cameraStream : micStream;
    const set = kind === "camera" ? setCamera : setMic;
    setDeviceError("");
    if (active) {
      ref.current?.getTracks().forEach((t) => t.stop());
      ref.current = null;
      set(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceError(
        "Device preview needs a supported browser on localhost or HTTPS. Text practice is always available.",
      );
      return;
    }
    setPending(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "camera"
          ? { video: true, audio: false }
          : { audio: true, video: false },
      );
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ref.current = stream;
      set(true);
    } catch {
      if (mounted.current)
        setDeviceError(
          `${kind === "camera" ? "Camera" : "Microphone"} access is unavailable or was denied. Check browser permissions, or continue with typed answers.`,
        );
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  function stopAll() {
    cameraStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current?.getTracks().forEach((t) => t.stop());
    cameraStream.current = null;
    micStream.current = null;
    setCamera(false);
    setMic(false);
  }
  return { videoRef, camera, mic, deviceError, pending, toggle, stopAll };
}
