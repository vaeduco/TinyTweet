"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BookmarkFolder } from "@/lib/types";

// --- Saving posts ----------------------------------------------------------

export type SaveResult = { error?: string; saved: boolean; folderId: string | null };

/**
 * Bookmark a post into a folder (folderId null = uncategorized). If it's
 * already saved, this moves it to the chosen folder.
 */
export async function saveToFolder(
  postId: string,
  folderId: string | null
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to save posts.", saved: false, folderId: null };
  }

  const { error } = await supabase
    .from("saved_posts")
    .upsert(
      { user_id: user.id, post_id: postId, folder_id: folderId },
      { onConflict: "user_id,post_id" }
    );
  if (error) return { error: error.message, saved: false, folderId: null };

  revalidatePath("/bookmarks");
  return { saved: true, folderId };
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

// --- Folders ---------------------------------------------------------------

export async function listFolders(): Promise<BookmarkFolder[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("bookmark_folders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []) as BookmarkFolder[];
}

export async function createFolder(
  name: string
): Promise<{ error?: string; folder?: BookmarkFolder }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name can't be empty." };
  if (trimmed.length > 50) return { error: "Folder name is too long (max 50)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data, error } = await supabase
    .from("bookmark_folders")
    .insert({ user_id: user.id, name: trimmed })
    .select("*")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/bookmarks");
  return { folder: data as BookmarkFolder };
}

export async function renameFolder(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name can't be empty." };
  if (trimmed.length > 50) return { error: "Folder name is too long (max 50)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // RLS also enforces ownership; the extra filter is defense in depth.
  const { error } = await supabase
    .from("bookmark_folders")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/bookmarks");
  return {};
}

/** Delete a folder. Its posts move back to uncategorized (FK ON DELETE SET NULL). */
export async function deleteFolder(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("bookmark_folders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/bookmarks");
  return {};
}
