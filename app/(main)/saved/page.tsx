import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getSavedPosts } from "@/lib/queries";
import { PostCard } from "@/components/post-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved" };

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const posts = await getSavedPosts(supabase, user.id);

  return (
    <div>
      <div className="sticky top-14 z-30 flex items-center gap-2 border-b border-border bg-background px-4 py-3 lg:top-0">
        <h1 className="text-xl font-bold">Saved</h1>
      </div>

      {posts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Bookmark className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-lg font-bold">No saved posts yet</p>
          <p className="mx-auto mt-1 max-w-xs text-muted-foreground">
            Tap the bookmark icon on a post to save it here for later.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} currentUserId={user.id} />
          ))}
        </div>
      )}
    </div>
  );
}
