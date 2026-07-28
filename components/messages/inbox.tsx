"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { ConversationAvatar } from "@/components/messages/conversation-avatar";
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
  const { isUnread } = useMessages();

  // New messages (in any of my conversations, RLS-scoped) update previews/order.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`inbox-refresh-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          if (timer) return; // coalesce a burst into a single refresh
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

  if (conversations.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-lg font-bold">No messages yet</p>
        <p className="mx-auto mt-1 max-w-xs text-muted-foreground">
          Start a conversation from someone&apos;s profile, or tap New message.
        </p>
      </div>
    );
  }

  return (
    <div>
      {conversations.map((c) => {
        const d = conversationDisplay(c, c.others, c.participants);
        const unread = isUnread(c.id);
        const mine = c.last_message_sender_id === currentUserId;
        const preview = c.last_message_preview ?? "No messages yet";
        return (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            className={cn(
              "flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/40",
              unread && "bg-primary/5"
            )}
          >
            <ConversationAvatar avatars={d.avatars} isGroup={d.isGroup} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("truncate", unread ? "font-bold" : "font-semibold")}>
                  {d.title}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(c.last_message_at)}
                </span>
              </div>
              <p
                className={cn(
                  "truncate text-sm",
                  unread ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {mine && "You: "}
                {preview}
              </p>
            </div>
            {unread && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                aria-label="Unread"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
