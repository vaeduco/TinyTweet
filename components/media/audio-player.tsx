"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Inline audio bubble with play/pause, a progress bar, and a time readout. */
export function AudioPlayer({
  src,
  durationSeconds,
  mine = false,
}: {
  src: string;
  durationSeconds?: number | null;
  mine?: boolean;
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  // webm blobs often report Infinity/NaN duration until played, so seed from
  // the recorded duration and refine from metadata when it's usable.
  const [total, setTotal] = React.useState(durationSeconds ?? 0);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else void a.play();
  }

  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const shown = playing || current > 0 ? current : total;

  return (
    <div
      className={cn(
        "flex min-w-[180px] max-w-[260px] items-center gap-2 rounded-2xl px-3 py-2",
        mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          mine ? "bg-primary-foreground/20" : "bg-foreground/10"
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className={cn(
            "h-1 w-full overflow-hidden rounded-full",
            mine ? "bg-primary-foreground/25" : "bg-foreground/15"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              mine ? "bg-primary-foreground" : "bg-foreground/60"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums opacity-80">{fmt(shown)}</span>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setTotal(d);
        }}
      />
    </div>
  );
}
