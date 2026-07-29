"use client";

import * as React from "react";
import { MoreHorizontal, Undo2 } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Attachment } from "@/components/media/attachment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageWithSender } from "@/lib/types";

export function MessageBubble({
  message,
  mine,
  showName,
  isLastOwn,
  onUnsend,
}: {
  message: MessageWithSender;
  mine: boolean;
  showName: boolean;
  isLastOwn: boolean;
  onUnsend: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleted = !!message.deleted_at;
  const canUnsend = mine && !deleted;

  const clearPress = React.useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    // Long-press on touch opens the menu; desktop uses hover-reveal instead.
    if (!canUnsend || e.pointerType === "mouse") return;
    clearPress();
    pressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  }

  const bubble = deleted ? (
    <div
      className={cn(
        "inline-block rounded-2xl bg-muted px-3.5 py-2 text-[15px] italic text-muted-foreground",
        mine ? "rounded-br-md" : "rounded-bl-md"
      )}
    >
      Message unsent
    </div>
  ) : (
    <div className={cn("flex flex-col gap-1", mine && "items-end")}>
      {message.content && (
        <div
          className={cn(
            "whitespace-pre-wrap break-anywhere rounded-2xl px-3.5 py-2 text-[15px] leading-snug",
            mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted text-foreground"
          )}
        >
          {message.content}
        </div>
      )}
      {message.attachment_url && message.attachment_type && (
        <Attachment
          url={message.attachment_url}
          type={message.attachment_type}
          durationSeconds={message.duration_seconds}
          mine={mine}
          className="max-w-full"
        />
      )}
    </div>
  );

  return (
    <div
      className={cn("group flex items-end gap-2 py-0.5", mine && "flex-row-reverse")}
    >
      {!mine ? (
        <UserAvatar profile={message.sender} className="h-7 w-7 shrink-0" />
      ) : (
        <span className="w-7 shrink-0" />
      )}

      <div
        className="max-w-[78%]"
        onPointerDown={onPointerDown}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onPointerCancel={clearPress}
      >
        {showName && (
          <p className="mb-0.5 px-1 text-xs text-muted-foreground">
            {message.sender.display_name || message.sender.username}
          </p>
        )}

        <div className={cn("flex items-center gap-1", mine && "flex-row-reverse")}>
          {bubble}
          {canUnsend && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Message options"
                  className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={mine ? "end" : "start"}>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    onUnsend(message.id);
                  }}
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  Unsend
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {mine ? (
          isLastOwn && !deleted ? (
            <p className="mt-0.5 px-1 text-right text-[11px] text-muted-foreground">
              {message.status === "delivered" ? "Delivered" : "Sent"}
            </p>
          ) : null
        ) : (
          <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">
            {formatRelativeTime(message.created_at)}
          </p>
        )}
      </div>
    </div>
  );
}
