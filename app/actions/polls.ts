"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PollOption } from "@/lib/types";

export type VotePollResult = {
  error?: string;
  /** Fresh per-option tallies so the client can reconcile exactly. */
  options?: Pick<PollOption, "id" | "vote_count">[];
  myVoteOptionId?: string;
};

/** Cast the viewer's single vote in a poll. Votes are final. */
export async function votePoll(
  pollId: string,
  optionId: string
): Promise<VotePollResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to vote." };

  const { error } = await supabase
    .from("poll_votes")
    .insert({ poll_id: pollId, option_id: optionId, user_id: user.id });

  if (error) {
    // Unique violation on (poll_id, user_id) => already voted.
    if (error.code === "23505") {
      return { error: "You've already voted in this poll." };
    }
    // The trigger raises a readable message for a closed poll or a mismatched
    // option; surface it directly.
    return { error: error.message };
  }

  const { data: opts } = await supabase
    .from("poll_options")
    .select("id, vote_count")
    .eq("poll_id", pollId)
    .order("position", { ascending: true });

  revalidatePath("/");
  return { options: opts ?? [], myVoteOptionId: optionId };
}
