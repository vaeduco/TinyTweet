"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { uploadToBucket } from "@/lib/upload";
import { EmojiPickerButton } from "@/components/media/emoji-picker-button";
import { ImageUploadButton } from "@/components/media/image-upload-button";
import { AudioRecorderButton } from "@/components/media/audio-recorder-button";
import type { ComposerAttachment } from "@/components/media/attachment-preview";

/**
 * Emoji / image (and optionally audio) buttons for a composer. Handles the
 * storage upload for images and audio.
 */
export function AttachmentToolbar({
  userId,
  bucket,
  includeAudio = false,
  onEmoji,
  onAttachment,
  onBusyChange,
  disabled,
}: {
  userId: string;
  bucket: string;
  includeAudio?: boolean;
  onEmoji: (emoji: string) => void;
  onAttachment: (att: ComposerAttachment) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [uploading, setUploading] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const busy = uploading || recording;

  React.useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  async function handleFile(
    file: File,
    type: "image" | "audio",
    durationSeconds?: number
  ) {
    setUploading(true);
    try {
      const ext =
        type === "audio"
          ? "webm"
          : file.name.split(".").pop()?.toLowerCase() || "jpg";
      const url = await uploadToBucket(supabase, bucket, userId, file, ext);
      onAttachment({ url, type, durationSeconds });
    } catch (e) {
      toast.error(
        `Upload failed: ${e instanceof Error ? e.message : "unknown error"}`
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <EmojiPickerButton onEmoji={onEmoji} disabled={disabled || busy} />
      <ImageUploadButton
        onPick={(f) => handleFile(f, "image")}
        disabled={disabled || busy}
      />
      {includeAudio && (
        <AudioRecorderButton
          onRecorded={(f, d) => handleFile(f, "audio", d)}
          onRecordingChange={setRecording}
          disabled={disabled || uploading}
        />
      )}
      {uploading && (
        <Loader2 className="ml-1 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
