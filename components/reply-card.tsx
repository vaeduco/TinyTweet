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
import { ReplyForm } from "@/components/reply-form";
import { renderContent } from "@/lib/parse";
import { formatRelativeTime } from "@/lib/format";
import type { Profile } from "@/lib/types";
import type { ReplyNode } from "@/lib/reply-tree";
import { deleteReply } from "@/app/actions/replies";

/** Levels of visual indentation before deeper replies are flattened, so a long
 * thread never squeezes the cards down to nothing. */
const MAX_INDENT_DEPTH = 3;

export function ReplyCard({
  node,
  viewer,
  currentUserId,
  depth = 0,
}: {
  node: ReplyNode;
  /** The signed-in user's profile, needed to render the inline reply box. */
  viewer: Profile | null;
  currentUserId: string | null;
  depth?: number;
}) {
  const router = useRouter();
  const author = node.author;

  const [deleted, setDeleted] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [replyOpen, setReplyOpen] = React.useState(false);

  const isOwner = currentUserId != null && currentUserId === node.user_id;
  const profileHref = `/${author.username}`;
  // Keep adding indentation only until the cap; beyond it, children render at
  // the same depth (a flat continuation) rather than marching off-screen.
  const indentChildren = depth < MAX_INDENT_DEPTH;
  const childDepth = Math.min(depth + 1, MAX_INDENT_DEPTH);

  if (deleted) return null;

  async function onDelete() {
    setIsDeleting(true);
    const res = await deleteReply(node.id, node.post_id);
    if (res.error) {
      toast.error(res.error);
      setIsDeleting(false);
    } else {
      setDeleted(true);
      toast.success("Reply deleted.");
      router.refresh();
    }
  }

  return (
    <div>
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
              title={new Date(node.created_at).toLocaleString()}
              suppressHydrationWarning
            >
              {formatRelativeTime(node.created_at)}
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

          {node.content && (
            <div className="mt-1 whitespace-pre-wrap break-anywhere text-[15px] leading-normal">
              {renderContent(node.content)}
            </div>
          )}

          {node.attachment_url && node.attachment_type && (
            <div className="mt-2">
              <Attachment
                url={node.attachment_url}
                type={node.attachment_type}
                imgClassName="max-h-[512px]"
              />
            </div>
          )}

          {viewer && (
            <button
              type="button"
              onClick={() => setReplyOpen((o) => !o)}
              aria-expanded={replyOpen}
              className="mt-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              Reply
            </button>
          )}

          {replyOpen && viewer && (
            <div className="mt-1.5">
              <ReplyForm
                postId={node.post_id}
                profile={viewer}
                parentReplyId={node.id}
                placeholder={`Reply to @${author.username}`}
                autoFocus
                embedded
                onDone={() => setReplyOpen(false)}
              />
            </div>
          )}
        </div>
      </article>

      {node.children.length > 0 && (
        <div
          className={
            indentChildren
              ? "mt-2 ml-3 flex flex-col gap-2 border-l-2 border-border pl-3"
              : "mt-2 flex flex-col gap-2"
          }
        >
          {node.children.map((child) => (
            <ReplyCard
              key={child.id}
              node={child}
              viewer={viewer}
              currentUserId={currentUserId}
              depth={childDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
