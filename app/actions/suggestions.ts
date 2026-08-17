"use server";

import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permanently dismiss a "Who to follow" suggestion so it's never surfaced
 * again. Own-only: the row is written under the viewer's id and RLS
 * (dismissed_suggestions_insert_self) rejects writing for anyone else. Idempotent
 * — re-dismissing the same account is a no-op upsert.
 */
export async function dismissSuggestion(
  targetId: string
): Promise<{ error?: string }> {
  if (!UUID_RE.test(targetId)) return { error: "Invalid account." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (user.id === targetId) return { error: "Invalid account." };

  // ON CONFLICT DO NOTHING — re-dismissing an already-dismissed account is a
  // no-op. (A default upsert would attempt an UPDATE, which this table has no
  // RLS policy for and would reject.)
  const { error } = await supabase
    .from("dismissed_suggestions")
    .upsert(
      { user_id: user.id, dismissed_id: targetId },
      { onConflict: "user_id,dismissed_id", ignoreDuplicates: true }
    );
  if (error) return { error: error.message };
  return {};
}
