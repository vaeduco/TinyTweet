import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHashtagPosts } from "@/lib/queries";
import { PostCard } from "@/components/post-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const clean = decodeURIComponent(tag).toLowerCase();
  return { title: `#${clean}` };
}

export default async function HashtagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const clean = decodeURIComponent(tag).toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const posts = await getHashtagPosts(supabase, clean, user?.id ?? null);

  return (
    <div>
      <div className="sticky top-14 lg:top-0 z-30 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
        <Link
          href="/"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">#{clean}</h1>
          <p className="text-sm text-muted-foreground">{posts.length} posts</p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="font-bold">No posts yet</p>
          <p className="mt-1 text-muted-foreground">
            Be the first to post with #{clean}.
          </p>
        </div>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} currentUserId={user?.id ?? null} />
        ))
      )}
    </div>
  );
}
