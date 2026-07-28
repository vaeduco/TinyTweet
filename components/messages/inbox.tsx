"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, Pin } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { ConversationAvatar } from "@/components/messages/conversation-avatar";
import { ConversationMenu } from "@/components/messages/conversation-menu";
import { useMessages } from "@/components/messages/messages-provider";
import { conversationDisplay } from "@/lib/conversation";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationWithMeta } from "@/lib/types";

export function Inbox({
  conversations,
  currentUserId,
}: {
  conversations: ConversationWithMeta[];
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const { isUnread, isMuted } = useMessages();
  const [tab, setTab] = React.useState<"all" | "archived">("all");

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`inbox-refresh-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          if (timer) return;
          timer = setTimeout(() => {
            timer = null;
            router.refresh();
          }, 400);
        }
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, router]);

  const filtered = conversations
    .filter((c) => (tab === "archived" ? c.is_archived : !c.is_archived))
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_pinned && b.is_pinned) {
        return (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "");
      }
      return b.last_message_at.localeCompare(a.last_message_at);
    });

  return (
    <div>
      <nav aria-label="Inbox filter" className="flex border-b border-border">
        {(["all", "archived"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors hover:bg-muted/40",
              tab === t
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            )}
          >
            {t === "all" ? "All" : "Archived"}
          </button>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-bold">
            {tab === "archived" ? "No archived chats" : "No messages yet"}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-muted-foreground">
            {tab === "archived"
              ? "Conversations you archive show up here."
              : "Start a conversation from someone's profile, or tap New message."}
          </p>
        </div>
      ) : (
        filtered.map((c) => {
          const d = conversationDisplay(c, c.others, c.participants);
          const muted = isMuted(c.id) || c.is_muted;
          const emph = isUnread(c.id) && !muted; // emphasise only un-muted unread
          const mine = c.last_message_sender_id === currentUserId;
          const preview = c.last_message_preview ?? "No messages yet";
          return (
            <div
              key={c.id}
              className={cn(
                "flex items-center border-b border-border pr-2 transition-colors hover:bg-muted/40",
                emph && "bg-primary/5"
              )}
            >
              <Link
                href={`/messages/${c.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4"
              >
                <ConversationAvatar avatars={d.avatars} isGroup={d.isGroup} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {c.is_pinned && (
                      <Pin
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-label="Pinned"
                      />
                    )}
                    <span className={cn("truncate", emph ? "font-bold" : "font-semibold")}>
                      {d.title}
                    </span>
                    {muted && (
                      <BellOff
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-label="Muted"
                      />
                    )}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(c.last_message_at)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "truncate text-sm",
                      emph ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {mine && "You: "}
                    {preview}
                  </p>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1 pl-1">
                {emph && (
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-primary"
                    aria-label="Unread"
                  />
                )}
                <ConversationMenu conversation={c} currentUserId={currentUserId} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
