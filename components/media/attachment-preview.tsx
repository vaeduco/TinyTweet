"use client";

import { X } from "lucide-react";

import { AudioPlayer } from "@/components/media/audio-player";
import { Button } from "@/components/ui/button";

export type ComposerAttachment = {
  url: string;
  type: "image" | "gif" | "audio";
  durationSeconds?: number;
};

/** Preview of the not-yet-sent attachment in a composer, with a remove control. */
export function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove: () => void;
}) {
  if (attachment.type === "audio") {
    return (
      <div className="mt-2 flex items-center gap-2">
        <AudioPlayer
          src={attachment.url}
          durationSeconds={attachment.durationSeconds}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label="Remove attachment"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative mt-2 w-fit max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.url}
        alt="Attachment preview"
        className="max-h-60 rounded-2xl border border-border object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
        aria-label="Remove attachment"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
