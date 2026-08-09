"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Attachment } from "@/components/media/attachment";
import { renderContent } from "@/lib/parse";
import { formatRelativeTime } from "@/lib/format";
import type { ReplyWithAuthor } from "@/lib/types";
import { deleteReply } from "@/app/actions/replies";

/**
 * Displays a single reply row — used for both a top-level comment and each of
 * its (one-level) replies. It has no "Reply" action of its own; the per-thread
 * reply box is owned by CommentThread. Only the author sees a delete menu.
 */
export function ReplyCard({
  reply,
  currentUserId,
  onDeleted,
}: {
  reply: ReplyWithAuthor;
  currentUserId: string | null;
  /** Called after this reply is deleted (lets a thread collapse itself). */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const author = reply.author;

  const [deleted, setDeleted] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const isOwner = currentUserId != null && currentUserId === reply.user_id;
  const profileHref = `/${author.username}`;

  if (deleted) return null;

  async function onDelete() {
    setIsDeleting(true);
    const res = await deleteReply(reply.id, reply.post_id);
    if (res.error) {
      toast.error(res.error);
      setIsDeleting(false);
    } else {
      setDeleted(true);
      toast.success("Reply deleted.");
      onDeleted?.();
      router.refresh();
    }
  }

  return (
    <article className="flex gap-3 rounded-[14px] bg-surface-1 px-3.5 py-2 shadow-sm">
      <Link href={profileHref} className="shrink-0" aria-label={author.username}>
        <UserAvatar profile={author} className="h-9 w-9" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={profileHref}
            className="truncate font-semibold hover:underline"
          >
            {author.display_name || author.username}
          </Link>
          <Link
            href={profileHref}
            className="truncate text-muted-foreground hover:underline"
          >
            @{author.username}
          </Link>
          <span className="text-muted-foreground">·</span>
          <span
            className="whitespace-nowrap text-muted-foreground"
            title={new Date(reply.created_at).toLocaleString()}
            suppressHydrationWarning
          >
            {formatRelativeTime(reply.created_at)}
          </span>

          {isOwner && (
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    aria-label="Reply options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={isDeleting}
                    onSelect={(e) => {
                      e.preventDefault();
                      onDelete();
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {reply.content && (
          <div className="mt-1 whitespace-pre-wrap break-anywhere text-[15px] leading-normal">
            {renderContent(reply.content)}
          </div>
        )}

        {reply.attachment_url && reply.attachment_type && (
          <div className="mt-2">
            <Attachment
              url={reply.attachment_url}
              type={reply.attachment_type}
              imgClassName="max-h-[512px]"
            />
          </div>
        )}
      </div>
    </article>
  );
}
