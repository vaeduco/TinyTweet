"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Smile } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Loosely-typed lazy wrapper: keeps the (heavy) emoji lib out of the initial
// bundle and avoids importing its enum types eagerly.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] w-[320px] items-center justify-center text-sm text-muted-foreground">
      Loading emoji…
    </div>
  ),
}) as unknown as React.ComponentType<{
  onEmojiClick: (emoji: { emoji: string }) => void;
  theme?: "light" | "dark" | "auto";
  lazyLoadEmojis?: boolean;
  width?: number | string;
  height?: number | string;
  previewConfig?: { showPreview?: boolean };
  skinTonesDisabled?: boolean;
}>;

export function EmojiPickerButton({
  onEmoji,
  disabled,
}: {
  onEmoji: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-primary"
          aria-label="Add emoji"
          disabled={disabled}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-0 p-0 shadow-lg"
        align="start"
        sideOffset={8}
      >
        <EmojiPicker
          onEmojiClick={(e) => {
            onEmoji(e.emoji);
            setOpen(false);
          }}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          lazyLoadEmojis
          width={320}
          height={400}
          previewConfig={{ showPreview: false }}
          skinTonesDisabled
        />
      </PopoverContent>
    </Popover>
  );
}
