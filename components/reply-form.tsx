"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_POST_LENGTH } from "@/lib/constants";
import { createReply } from "@/app/actions/replies";
import type { Profile } from "@/lib/types";

export function ReplyForm({
  postId,
  profile,
  parentReplyId = null,
}: {
  postId: string;
  profile: Profile | null;
  parentReplyId?: string | null;
}) {
  const router = useRouter();
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!profile) {
    return (
      <div className="border-b border-border px-4 py-6 text-center text-sm text-muted-foreground">
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
  const canSubmit = content.trim().length > 0 && !overLimit && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    const res = await createReply({
      postId,
      content: content.trim(),
      parentReplyId: parentReplyId ?? null,
    });

    if (res.error) {
      toast.error(res.error);
      setSubmitting(false);
      return;
    }

    setContent("");
    setSubmitting(false);
    toast.success("Your reply was posted.");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex gap-3 border-b border-border px-4 py-3"
    >
      <UserAvatar profile={profile} className="h-10 w-10 shrink-0" />

      <div className="min-w-0 flex-1">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Post your reply"
          rows={2}
          className="min-h-[52px] resize-none border-0 bg-transparent px-0 py-2 text-lg shadow-none focus-visible:ring-0"
        />

        <div className="mt-2 flex items-center justify-end gap-3">
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
          <Button type="submit" disabled={!canSubmit} className="px-5">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Reply
          </Button>
        </div>
      </div>
    </form>
  );
}
