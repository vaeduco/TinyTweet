"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BookmarkCategory } from "@/lib/types";

// --- Saving posts ----------------------------------------------------------

export type SaveResult = { error?: string; saved: boolean; categoryId: string | null };

/**
 * Bookmark a post into a category (categoryId null = uncategorized). If it's
 * already saved, this moves it to the chosen category.
 */
export async function saveToCategory(
  postId: string,
  categoryId: string | null
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save posts.", saved: false, categoryId: null };
  }

  const { error } = await supabase
    .from("saved_posts")
    .upsert(
      { user_id: user.id, post_id: postId, category_id: categoryId },
      { onConflict: "user_id,post_id" }
    );
  if (error) return { error: error.message, saved: false, categoryId: null };

  revalidatePath("/bookmarks");
  return { saved: true, categoryId };
}

export async function removeSave(
  postId: string
): Promise<{ error?: string; saved: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", saved: true };

  const { error } = await supabase
    .from("saved_posts")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);
  if (error) return { error: error.message, saved: true };

  revalidatePath("/bookmarks");
  return { saved: false };
}

// --- Categories ---------------------------------------------------------------

export async function listCategories(): Promise<BookmarkCategory[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("bookmark_categories")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []) as BookmarkCategory[];
}

export async function createCategory(
  name: string
): Promise<{ error?: string; category?: BookmarkCategory }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Category name can't be empty." };
  if (trimmed.length > 50) return { error: "Category name is too long (max 50)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data, error } = await supabase
    .from("bookmark_categories")
    .insert({ user_id: user.id, name: trimmed })
    .select("*")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/bookmarks");
  return { category: data as BookmarkCategory };
}

export async function renameCategory(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Category name can't be empty." };
  if (trimmed.length > 50) return { error: "Category name is too long (max 50)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // RLS also enforces ownership; the extra filter is defense in depth.
  const { error } = await supabase
    .from("bookmark_categories")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/bookmarks");
  return {};
}

/** Delete a category. Its posts move back to uncategorized (FK ON DELETE SET NULL). */
export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("bookmark_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/bookmarks");
  return {};
}
