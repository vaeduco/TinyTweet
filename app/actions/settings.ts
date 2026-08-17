"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { validateUsername, normalizeUsername } from "@/lib/validation";
import type { DmPrivacy } from "@/lib/types";

type Result = { error?: string };

// --- Account ----------------------------------------------------------------

export async function updateAccount(input: {
  username?: string;
  display_name?: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const update: { username?: string; display_name?: string | null } = {};
  if (input.username !== undefined) {
    const err = validateUsername(input.username);
    if (err) return { error: err };
    update.username = normalizeUsername(input.username);
  }
  if (input.display_name !== undefined) {
    const trimmed = (input.display_name ?? "").trim();
    update.display_name = trimmed ? trimmed.slice(0, 50) : null;
  }
  if (Object.keys(update).length === 0) return {};

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { error: "That username is already taken." };
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function changeEmail(newEmail: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const email = newEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (email === user.email) return { error: "That's already your email." };

  // Supabase sends a confirmation link; the change applies once confirmed.
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { error: error.message };
  return {};
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "You must be signed in." };
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  // Verify the current password on a throwaway client so the live session
  // (and its cookies) are never disturbed.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: verifyErr } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyErr) return { error: "Your current password is incorrect." };
  // Revoke ONLY the throwaway verifier session (local scope) — a global sign-out
  // would kill the user's real sessions everywhere, including this one.
  await verifier.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return {};
}

export async function deleteAccount(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Full cascade delete via the service role: removing the auth user cascades
  // to the profile and everything referencing it. (Irreversible.)
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  return {};
}

// --- Privacy ----------------------------------------------------------------

export async function setDmPrivacy(value: DmPrivacy): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ dm_privacy: value })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function setPrivate(value: boolean): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // RPC: sets is_private and, when going public, accepts outstanding requests.
  const { error } = await supabase.rpc("set_account_private", {
    p_value: value,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function blockUser(targetId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.rpc("block_user", { p_target: targetId });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function unblockUser(targetId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

// --- Notifications ----------------------------------------------------------

export async function setNotificationPrefs(prefs: {
  notify_follows?: boolean;
  notify_likes?: boolean;
  notify_replies?: boolean;
  notify_mentions?: boolean;
  notify_sound?: boolean;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Whitelist only the known boolean columns (never trust the raw payload).
  const update: {
    notify_follows?: boolean;
    notify_likes?: boolean;
    notify_replies?: boolean;
    notify_mentions?: boolean;
    notify_sound?: boolean;
  } = {};
  for (const k of [
    "notify_follows",
    "notify_likes",
    "notify_replies",
    "notify_mentions",
    "notify_sound",
  ] as const) {
    if (typeof prefs[k] === "boolean") update[k] = prefs[k];
  }
  if (Object.keys(update).length === 0) return {};

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}
