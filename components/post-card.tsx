"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renderContent } from "@/lib/parse";
import { formatRelativeTime, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PostWithAuthor } from "@/lib/types";
import { toggleLike } from "@/app/actions/likes";
import { toggleSave } from "@/app/actions/saves";
import { deletePost } from "@/app/actions/posts";

export function PostCard({
  post,
  currentUserId,
  highlight = false,
}: {
  post: PostWithAuthor;
  currentUserId: string | null;
  /** Emphasise the card (used as the root post on a thread page). */
  highlight?: boolean;
}) {
  const router = useRouter();
  const author = post.author;

  const [liked, setLiked] = React.useState(post.liked_by_me);
  const [likeCount, setLikeCount] = React.useState(post.like_count);
  const [likePending, setLikePending] = React.useState(false);
  const [saved, setSaved] = React.useState(post.saved_by_me);
  const [savePending, setSavePending] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const isOwner = currentUserId != null && currentUserId === post.user_id;
  const profileHref = `/${author.username}`;
  const postHref = `/post/${post.id}`;

  if (deleted) return null;

  async function onLike() {
    if (!currentUserId) {
      toast.error("Sign in to like posts.");
      return;
    }
    if (likePending) return;
    setLikePending(true);

    const prevLiked = liked;
    const prevCount = likeCount;
    // Optimistic update
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));

    const res = await toggleLike(post.id);
    if (res.error) {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      toast.error(res.error);
    } else {
      setLiked(res.liked);
    }
    setLikePending(false);
  }

  async function onDelete() {
    setIsDeleting(true);
    const res = await deletePost(post.id);
    if (res.error) {
      toast.error(res.error);
      setIsDeleting(false);
    } else {
      setDeleted(true);
      toast.success("Post deleted.");
      router.refresh();
    }
  }

  async function onShare() {
    const url = `${window.location.origin}${postHref}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "TinyTweet", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard.");
      }
    } catch {
      /* user cancelled share sheet — ignore */
    }
  }

  async function onSave() {
    if (!currentUserId) {
      toast.error("Sign in to save posts.");
      return;
    }
    if (savePending) return;
    setSavePending(true);

    const prevSaved = saved;
    setSaved(!prevSaved); // optimistic
    const res = await toggleSave(post.id);
    if (res.error) {
      setSaved(prevSaved);
      toast.error(res.error);
    } else {
      setSaved(res.saved);
    }
    setSavePending(false);
  }

  return (
    <article
      className={cn(
        "flex gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 transition-colors",
        highlight && "ring-1 ring-primary/40"
      )}
    >
      <Link href={profileHref} className="shrink-0" aria-label={author.username}>
        <UserAvatar profile={author} className="h-10 w-10" />
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
          <Link
            href={postHref}
            className="whitespace-nowrap text-muted-foreground hover:underline"
            title={new Date(post.created_at).toLocaleString()}
            suppressHydrationWarning
          >
            {formatRelativeTime(post.created_at)}
          </Link>

          {isOwner && (
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    aria-label="Post options"
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

        <div className="mt-1 whitespace-pre-wrap break-anywhere text-[15px] leading-normal">
          {renderContent(post.content)}
        </div>

        {post.image_url && (
          <Link href={postHref} className="mt-2 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image_url}
              alt="Post attachment"
              className="max-h-[512px] w-full rounded-2xl border border-border object-cover"
              loading="lazy"
            />
          </Link>
        )}

        <div className="mt-2 flex max-w-md items-center justify-between text-muted-foreground">
          <Link
            href={postHref}
            className="group flex items-center gap-1.5 rounded-full text-sm transition-colors hover:text-primary"
            aria-label="Reply"
          >
            <span className="rounded-full p-1.5 group-hover:bg-primary/10">
              <MessageCircle className="h-[18px] w-[18px]" />
            </span>
            {post.reply_count > 0 && <span>{formatCount(post.reply_count)}</span>}
          </Link>

          <button
            type="button"
            onClick={onLike}
            className={cn(
              "group flex items-center gap-1.5 rounded-full text-sm transition-colors hover:text-rose-600 dark:hover:text-rose-500",
              liked && "text-rose-600 dark:text-rose-500"
            )}
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <span className="rounded-full p-1.5 group-hover:bg-rose-500/10">
              <Heart
                className={cn("h-[18px] w-[18px]", liked && "fill-current")}
              />
            </span>
            {likeCount > 0 && <span>{formatCount(likeCount)}</span>}
          </button>

          <button
            type="button"
            onClick={onShare}
            className="group flex items-center gap-1.5 rounded-full text-sm transition-colors hover:text-primary"
            aria-label="Share"
          >
            <span className="rounded-full p-1.5 group-hover:bg-primary/10">
              <Share2 className="h-[18px] w-[18px]" />
            </span>
          </button>

          <button
            type="button"
            onClick={onSave}
            className={cn(
              "group flex items-center gap-1.5 rounded-full text-sm transition-colors hover:text-primary",
              saved && "text-primary"
            )}
            aria-pressed={saved}
            aria-label={saved ? "Remove bookmark" : "Save"}
          >
            <span className="rounded-full p-1.5 group-hover:bg-primary/10">
              <Bookmark
                className={cn("h-[18px] w-[18px]", saved && "fill-current")}
              />
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
