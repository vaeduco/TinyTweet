"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, BellOff, MessagesSquare, PenSquare, Pin } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ConversationAvatar } from "@/components/messages/conversation-avatar";
import { ConversationMenu } from "@/components/messages/conversation-menu";
import { useMessages } from "@/components/messages/messages-provider";
import { usePresence } from "@/components/presence/presence-provider";
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
  const { isOnline } = usePresence();
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
        <EmptyState
          icon={tab === "archived" ? Archive : MessagesSquare}
          title={tab === "archived" ? "No archived chats" : "No messages yet"}
          description={
            tab === "archived"
              ? "Conversations you archive show up here."
              : "Start a conversation from someone's profile, or tap New message."
          }
        >
          {tab === "all" && (
            <Button asChild size="sm">
              <Link href="/messages/new">
                <PenSquare className="h-4 w-4" />
                New message
              </Link>
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {filtered.map((c) => {
          const d = conversationDisplay(c, c.others, c.participants);
          const muted = isMuted(c.id) || c.is_muted;
          const emph = isUnread(c.id) && !muted; // emphasise only un-muted unread
          const mine = c.last_message_sender_id === currentUserId;
          const preview = c.last_message_preview ?? "No messages yet";
          const peer = !c.is_group ? c.others[0] : undefined;
          const peerOnline = !!peer && isOnline(peer.id);
          return (
            <div
              key={c.id}
              className={cn(
                "flex items-center rounded-[14px] pr-2 shadow-sm transition-colors",
                emph
                  ? "bg-primary/5 hover:bg-primary/10"
                  : "bg-surface-1 hover:bg-surface-2/40"
              )}
            >
              <Link
                href={`/messages/${c.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3.5"
              >
                <span className="relative shrink-0">
                  <ConversationAvatar
                    avatars={d.avatars}
                    isGroup={d.isGroup}
                    ringClassName="border-surface-1"
                  />
                  {peerOnline && (
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface-1 bg-green-500"
                      aria-label="Active now"
                    />
                  )}
                </span>
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
          })}
        </div>
      )}
    </div>
  );
}
