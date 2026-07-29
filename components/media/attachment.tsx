"use client";

import { AudioPlayer } from "@/components/media/audio-player";
import { cn } from "@/lib/utils";
import type { MessageAttachmentType } from "@/lib/types";

/** Renders a stored attachment (image / gif / audio). */
export function Attachment({
  url,
  type,
  durationSeconds,
  mine = false,
  className,
  imgClassName = "max-h-80",
}: {
  url: string;
  type: MessageAttachmentType | null;
  durationSeconds?: number | null;
  mine?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  if (type === "audio") {
    return (
      <AudioPlayer src={url} durationSeconds={durationSeconds} mine={mine} />
    );
  }

  // Defense-in-depth: only treat http(s) URLs as a clickable link so a
  // javascript:/data: URL that somehow reached the DB can't run on click.
  const safeHref = /^https?:\/\//i.test(url) ? url : undefined;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={type === "gif" ? "GIF attachment" : "Image attachment"}
      className={cn("w-full object-cover", imgClassName)}
      loading="lazy"
    />
  );

  if (!safeHref) {
    return (
      <span
        className={cn(
          "block overflow-hidden rounded-2xl border border-border",
          className
        )}
      >
        {img}
      </span>
    );
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block overflow-hidden rounded-2xl border border-border",
        className
      )}
    >
      {img}
    </a>
  );
}
