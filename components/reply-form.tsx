"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentToolbar } from "@/components/media/attachment-toolbar";
import {
  AttachmentPreview,
  type ComposerAttachment,
} from "@/components/media/attachment-preview";
import { cn } from "@/lib/utils";
import { MAX_POST_LENGTH, POST_IMAGES_BUCKET } from "@/lib/constants";
import { createReply } from "@/app/actions/replies";
import type { Profile } from "@/lib/types";

export function ReplyForm({
  postId,
  profile,
  parentReplyId = null,
  placeholder = "Post your reply",
  autoFocus = false,
  embedded = false,
  onDone,
  onCancel,
}: {
  postId: string;
  profile: Profile | null;
  parentReplyId?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  /** Compact, chrome-less styling for an inline reply nested under a comment. */
  embedded?: boolean;
  /** Called after a reply posts successfully (e.g. to close the inline box). */
  onDone?: () => void;
  /** When provided, shows a Cancel button (and Escape) to dismiss the box. */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = React.useState("");
  const [attachment, setAttachment] = React.useState<ComposerAttachment | null>(
    null
  );
  const [toolbarBusy, setToolbarBusy] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  if (!profile) {
    return (
      <div className="rounded-[14px] bg-surface-1 px-4 py-6 text-center text-sm text-muted-foreground shadow-sm">
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>{" "}
        to reply.
      </div>
    );
  }

  const remaining = MAX_POST_LENGTH - content.length;
  const overLimit = remaining < 0;
  const canSubmit =
    (content.trim().length > 0 || !!attachment) &&
    !overLimit &&
    !submitting &&
    !toolbarBusy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    const res = await createReply({
      postId,
      content: content.trim(),
      parentReplyId: parentReplyId ?? null,
      attachmentUrl: attachment?.url ?? null,
      attachmentType:
        attachment && attachment.type !== "audio" ? attachment.type : null,
    });

    if (res.error) {
      toast.error(res.error);
      setSubmitting(false);
      return;
    }

    setContent("");
    setAttachment(null);
    setSubmitting(false);
    toast.success("Your reply was posted.");
    router.refresh();
    onDone?.();
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex gap-3",
        embedded
          ? "gap-2.5"
          : "rounded-[14px] bg-surface-1 px-3.5 py-2 shadow-sm"
      )}
    >
      <UserAvatar profile={profile} className="h-7 w-7 shrink-0" />

      <div className="min-w-0 flex-1">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Escape" && onCancel && !submitting) {
              e.preventDefault();
              onCancel();
            }
          }}
          className="min-h-[34px] w-full resize-none border-0 bg-transparent px-0 py-1 text-lg leading-snug shadow-none focus-visible:ring-0"
        />

        {attachment && (
          <AttachmentPreview
            attachment={attachment}
            onRemove={() => setAttachment(null)}
          />
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <AttachmentToolbar
            userId={profile.id}
            bucket={POST_IMAGES_BUCKET}
            onEmoji={(emoji) => setContent((c) => c + emoji)}
            onAttachment={(att) => setAttachment(att)}
            onBusyChange={setToolbarBusy}
            disabled={submitting}
          />

          <div className="flex items-center gap-2">
            {content.length > 0 && (
              <span
                className={cn(
                  "text-sm tabular-nums",
                  overLimit
                    ? "font-semibold text-destructive"
                    : remaining <= 20
                    ? "text-amber-700 dark:text-amber-500"
                    : "text-muted-foreground"
                )}
              >
                {remaining}
              </span>
            )}
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-3"
                disabled={submitting}
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={!canSubmit} className="px-4">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Reply
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
