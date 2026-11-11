"use client";
import { useEffect, useRef, useState } from "react";
import { recordingType } from "./media";

export function useRecorder(
  stream: MediaStream | null,
  maxSeconds = 120,
  onRecorded?: (audio: Blob) => void,
) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const mounted = useRef(true);
  const recorded = useRef(onRecorded);
  useEffect(() => {
    recorded.current = onRecorded;
  }, [onRecorded]);
  useEffect(() => {
    mounted.current = true;
    // Background throttling must not extend a recording beyond its local bound.
    const hidden = () => {
      if (document.hidden && recorder.current?.state === "recording") {
        timers.current.forEach(clearInterval);
        timers.current = [];
        recorder.current.stop();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", hidden);
      timers.current.forEach(clearInterval);
      if (recorder.current?.state === "recording") recorder.current.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);
  function stop() {
    timers.current.forEach(clearInterval);
    timers.current = [];
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  function start() {
    setError("");
    setBlob(null);
    setSeconds(0);
    const mime = recordingType();
    const mic = stream?.getAudioTracks()[0];
    if (!stream || !mime || !mic || mic.readyState !== "live" || mic.muted) {
      setError("Microphone unavailable. Retry device checks.");
      return;
    }
    // Never start while a question is playing through the speakers.
    window.speechSynthesis?.cancel();
    document.querySelectorAll("audio").forEach((audio) => audio.pause());
    if (window.speechSynthesis?.speaking) {
      setError("Wait for question playback to stop, then start answering.");
      return;
    }
    try {
      const next = new MediaRecorder(new MediaStream([mic]), {
        mimeType: mime,
        audioBitsPerSecond: 64000,
      });
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.current = next;
      next.ondataavailable = (e) => {
        bytes += e.data.size;
        if (bytes > 8 * 1024 * 1024) {
          chunks.length = 0;
          stop();
          if (mounted.current)
            setError("Recording exceeded 8 MB. Record a shorter answer.");
          return;
        }
        if (e.data.size) chunks.push(e.data);
      };
      next.onerror = () => {
        stop();
        if (mounted.current)
          setError(
            "Recording interrupted. Check the microphone and re-record.",
          );
      };
      next.onstop = () => {
        timers.current.forEach(clearInterval);
        timers.current = [];
        if (mounted.current) {
          setRecording(false);
          if (bytes && bytes <= 8 * 1024 * 1024) {
            const audio = new Blob(chunks, { type: mime });
            setBlob(audio);
            recorded.current?.(audio);
          }
        }
        chunks.length = 0;
      };
      next.start(500);
      setRecording(true);
      const began = performance.now();
      timers.current = [
        setInterval(() => {
          const elapsedMs = performance.now() - began;
          const elapsed = Math.floor(elapsedMs / 1000);
          setSeconds(elapsed);
          if (
            elapsedMs >= maxSeconds * 1000 - 500 ||
            mic.readyState !== "live" ||
            mic.muted
          )
            stop();
        }, 250),
      ];
    } catch {
      setError(
        "This recording format could not be started. Try another browser.",
      );
    }
  }
  return {
    recording,
    blob,
    error,
    seconds,
    start,
    stop,
    discard: () => setBlob(null),
  };
}
