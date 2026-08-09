"use client";

import * as React from "react";

import { ReplyCard } from "@/components/reply-card";
import { ReplyForm } from "@/components/reply-form";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import type { ReplyThread } from "@/lib/reply-threads";

/**
 * One comment thread: the top-level comment, its replies listed flat and
 * indented once beneath it, and an on-demand reply box. Only the top-level
 * comment offers a "Reply" action — replies can't be replied to, so threading
 * stays a single level. The box is hidden until "Reply" is tapped and collapses
 * on submit or cancel.
 */
export function CommentThread({
  thread,
  viewer,
  currentUserId,
}: {
  thread: ReplyThread;
  /** Signed-in user's profile, needed to compose a reply. Null = logged out. */
  viewer: Profile | null;
  currentUserId: string | null;
}) {
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [commentDeleted, setCommentDeleted] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const wasOpen = React.useRef(false);
  const { comment, replies } = thread;
  const hasReplies = replies.length > 0;

  // Return focus to the "Reply" trigger when the box closes (submit/cancel/Esc),
  // so keyboard/screen-reader users aren't dropped to the top of the document
  // (WCAG 2.4.3). Runs after commit — once the trigger has re-mounted — and only
  // on the open→closed transition, never on the initial (already-closed) render.
  React.useEffect(() => {
    if (wasOpen.current && !replyOpen) triggerRef.current?.focus();
    wasOpen.current = replyOpen;
  }, [replyOpen]);

  const closeBox = () => setReplyOpen(false);

  // Deleting the top-level comment collapses the whole thread immediately; the
  // subsequent router.refresh re-roots any orphaned replies (ON DELETE SET NULL).
  if (commentDeleted) return null;

  return (
    <div>
      <ReplyCard
        reply={comment}
        currentUserId={currentUserId}
        onDeleted={() => setCommentDeleted(true)}
      />

      {(hasReplies || replyOpen) && (
        <div
          className={cn(
            "mt-2 ml-3 flex flex-col gap-2 pl-3",
            hasReplies && "border-l-2 border-border"
          )}
        >
          {replies.map((r) => (
            <ReplyCard key={r.id} reply={r} currentUserId={currentUserId} />
          ))}

          {replyOpen && viewer && (
            <ReplyForm
              postId={comment.post_id}
              profile={viewer}
              parentReplyId={comment.id}
              placeholder={`Reply to @${comment.author.username}`}
              autoFocus
              embedded
              onDone={closeBox}
              onCancel={closeBox}
            />
          )}
        </div>
      )}

      {viewer && !replyOpen && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setReplyOpen(true)}
          aria-label={`Reply to @${comment.author.username}`}
          className="ml-3 mt-1.5 rounded px-1.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Reply
        </button>
      )}
    </div>
  );
}
