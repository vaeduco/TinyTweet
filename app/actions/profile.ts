"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(input: {
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const update: {
    display_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
  } = {};

  if (input.display_name !== undefined) {
    const trimmed = (input.display_name ?? "").trim();
    update.display_name = trimmed ? trimmed.slice(0, 50) : null;
  }
  if (input.bio !== undefined) {
    const trimmed = (input.bio ?? "").trim();
    update.bio = trimmed ? trimmed.slice(0, 160) : null;
  }
  if (input.avatar_url !== undefined) {
    update.avatar_url = input.avatar_url || null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Refresh navbar avatar and any profile view across the app.
  revalidatePath("/", "layout");
  return {};
}
