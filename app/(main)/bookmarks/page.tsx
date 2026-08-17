import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Compass } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getBookmarkCategories, getSavedPosts } from "@/lib/queries";
import { PostCard } from "@/components/post-card";
import { BookmarkCategoryBar } from "@/components/bookmark-category-bar";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookmarks" };

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { category } = await searchParams;
  const categories = await getBookmarkCategories(supabase, user.id);
  // Only honor a category id the user actually owns; otherwise show all.
  const activeCategoryId =
    category && categories.some((f) => f.id === category) ? category : undefined;
  const activeCategory = categories.find((f) => f.id === activeCategoryId);
  const posts = await getSavedPosts(supabase, user.id, activeCategoryId);

  return (
    <div>
      <div className="sticky top-14 z-30 bg-background">
        <div className="flex items-center px-4 py-3">
          <h1 className="text-xl font-bold">Bookmarks</h1>
        </div>
        <BookmarkCategoryBar categories={categories} activeCategoryId={activeCategoryId} />
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={
            activeCategory
              ? `Nothing in “${activeCategory.name}” yet`
              : "No bookmarks yet"
          }
          description={
            activeCategory
              ? "Save posts into this category from the bookmark icon on any post."
              : "Tap the bookmark icon on a post to save it here for later."
          }
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/explore">
              <Compass className="h-4 w-4" />
              Explore posts
            </Link>
          </Button>
        </EmptyState>
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
