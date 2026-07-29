"use client";

import * as React from "react";
import { Mic, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const MAX_SECONDS = 120;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function AudioRecorderButton({
  onRecorded,
  onRecordingChange,
  disabled,
}: {
  onRecorded: (file: File, durationSeconds: number) => void;
  onRecordingChange?: (recording: boolean) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const startRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = React.useRef(false);
  const activeRef = React.useRef(true);

  const cleanup = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setElapsed(0);
    onRecordingChange?.(false);
  }, [onRecordingChange]);

  // Stop everything if the component unmounts mid-recording.
  React.useEffect(() => {
    return () => {
      activeRef.current = false;
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function start() {
    if (disabled || recording) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("Audio recording isn't supported in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access was denied.");
      return;
    }

    // The component may have unmounted while the permission prompt was open —
    // release the mic instead of starting an unstoppable recording.
    if (!activeRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    cancelledRef.current = false;
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const wasCancelled = cancelledRef.current;
      const durationSeconds = Math.max(
        1,
        Math.round((performance.now() - startRef.current) / 1000)
      );
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      cleanup();
      if (wasCancelled || blob.size === 0) return;
      const file = new File([blob], `voice-${Date.now()}.webm`, {
        type: blob.type,
      });
      onRecorded(file, durationSeconds);
    };

    startRef.current = performance.now();
    recorder.start();
    setRecording(true);
    onRecordingChange?.(true);
    timerRef.current = setInterval(() => {
      const secs = Math.round((performance.now() - startRef.current) / 1000);
      setElapsed(secs);
      if (secs >= MAX_SECONDS) stop();
    }, 250);
  }

  function stop() {
    if (!recorderRef.current) return;
    // Stop the timer first so no late tick can re-enter stop()/flip flags.
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      recorderRef.current.stop();
    } catch {
      cleanup();
    }
  }

  function cancel() {
    cancelledRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      recorderRef.current?.stop();
    } catch {
      cleanup();
    }
  }

  if (recording) {
    return (
      <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
        <span
          className="h-2 w-2 animate-pulse rounded-full bg-red-500"
          aria-hidden
        />
        <span
          className="min-w-[34px] text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {fmt(elapsed)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={cancel}
          aria-label="Cancel recording"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="h-7 w-7"
          onClick={stop}
          aria-label="Stop and attach recording"
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-primary"
      aria-label="Record audio"
      disabled={disabled}
      onClick={start}
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
