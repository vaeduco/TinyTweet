"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  LogOut,
  Mail,
  MailOpen,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessages } from "@/components/messages/messages-provider";
import {
  deleteConversation,
  leaveConversation,
  setConversationArchived,
  setConversationPinned,
} from "@/app/actions/messages";
import type { ConversationWithMeta } from "@/lib/types";

export function ConversationMenu({
  conversation,
  currentUserId,
}: {
  conversation: ConversationWithMeta;
  currentUserId: string;
}) {
  const router = useRouter();
  const { isUnread, isMuted, markRead, markUnread, setMuted, forget } =
    useMessages();

  const c = conversation;
  const unread = isUnread(c.id);
  const muted = isMuted(c.id) || c.is_muted;
  // "Mark as unread" only persists when the last message is from someone else.
  const canMarkUnread = c.last_message_sender_id !== currentUserId;

  async function run(
    action: Promise<{ error?: string }>,
    onOk?: () => void
  ) {
    const res = await action;
    if (res.error) {
      toast.error(res.error);
      return;
    }
    onOk?.();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          aria-label="Conversation options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onSelect={() => void run(setConversationPinned(c.id, !c.is_pinned))}
        >
          {c.is_pinned ? (
            <>
              <PinOff className="mr-2 h-4 w-4" />
              Unpin
            </>
          ) : (
            <>
              <Pin className="mr-2 h-4 w-4" />
              Pin
            </>
          )}
        </DropdownMenuItem>

        {(unread || canMarkUnread) && (
          <DropdownMenuItem
            onSelect={() => {
              if (unread) markRead(c.id);
              else markUnread(c.id);
              router.refresh();
            }}
          >
            {unread ? (
              <>
                <MailOpen className="mr-2 h-4 w-4" />
                Mark as read
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Mark as unread
              </>
            )}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onSelect={() => {
            setMuted(c.id, !muted);
            router.refresh();
          }}
        >
          {muted ? (
            <>
              <Bell className="mr-2 h-4 w-4" />
              Unmute
            </>
          ) : (
            <>
              <BellOff className="mr-2 h-4 w-4" />
              Mute
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() =>
            void run(setConversationArchived(c.id, !c.is_archived))
          }
        >
          {c.is_archived ? (
            <>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Unarchive
            </>
          ) : (
            <>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() =>
            void run(deleteConversation(c.id), () =>
              forget(c.id, { keepMuted: true })
            )
          }
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete conversation
        </DropdownMenuItem>

        {c.is_group && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() =>
              void run(leaveConversation(c.id), () => forget(c.id))
            }
          >
            <LogOut className="mr-2 h-4 w-4" />
            Leave group
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
