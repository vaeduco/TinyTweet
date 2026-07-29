"use client";

import * as React from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ImageUploadButton({
  onPick,
  disabled,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }
    onPick(picked);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-primary"
        aria-label="Add image"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="h-5 w-5" />
      </Button>
    </>
  );
}
