import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getPost, getReplies } from "@/lib/queries";
import { buildReplyThreads } from "@/lib/reply-threads";
import { PostCard } from "@/components/post-card";
import { ReplyForm } from "@/components/reply-form";
import { CommentThread } from "@/components/comment-thread";
import type { Profile } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const post = await getPost(supabase, id, null);
  return { title: post ? `Post by @${post.author.username}` : "Post" };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const post = await getPost(supabase, id, user?.id ?? null);
  if (!post) notFound();

  const replies = await getReplies(supabase, id);
  const threads = buildReplyThreads(replies);

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = (data as Profile) ?? null;
  }

  return (
    <div>
      <div className="sticky top-14 z-30 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
        <Link
          href="/"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Post</h1>
      </div>

      <div className="flex flex-col gap-2 p-2">
        <PostCard post={post} currentUserId={user?.id ?? null} highlight />
        <ReplyForm postId={post.id} profile={profile} />

        {threads.length > 0 && (
          <>
            <h2 className="px-1.5 pt-0.5 text-sm font-semibold text-muted-foreground">
              Replies
            </h2>
            {threads.map((thread) => (
              <CommentThread
                key={thread.comment.id}
                thread={thread}
                viewer={profile}
                currentUserId={user?.id ?? null}
              />
            ))}
          </>
        )}
      </div>

      {threads.length === 0 && (
        <div className="px-6 py-10 text-center">
          <p className="font-semibold">No replies yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to reply.
          </p>
        </div>
      )}
    </div>
  );
}
