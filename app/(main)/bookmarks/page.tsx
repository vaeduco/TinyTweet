import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getBookmarkFolders, getSavedPosts } from "@/lib/queries";
import { PostCard } from "@/components/post-card";
import { BookmarkFolderBar } from "@/components/bookmark-folder-bar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookmarks" };

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { folder } = await searchParams;
  const folders = await getBookmarkFolders(supabase, user.id);
  // Only honor a folder id the user actually owns; otherwise show all.
  const activeFolderId =
    folder && folders.some((f) => f.id === folder) ? folder : undefined;
  const activeFolder = folders.find((f) => f.id === activeFolderId);
  const posts = await getSavedPosts(supabase, user.id, activeFolderId);

  return (
    <div>
      <div className="sticky top-14 z-30 bg-background">
        <div className="flex items-center px-4 py-3">
          <h1 className="text-xl font-bold">Bookmarks</h1>
        </div>
        <BookmarkFolderBar folders={folders} activeFolderId={activeFolderId} />
      </div>

      {posts.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Bookmark className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-lg font-bold">
            {activeFolder
              ? `Nothing in “${activeFolder.name}” yet`
              : "No bookmarks yet"}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-muted-foreground">
            {activeFolder
              ? "Save posts into this folder from the bookmark icon on any post."
              : "Tap the bookmark icon on a post to save it here for later."}
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
