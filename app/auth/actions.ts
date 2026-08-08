"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, validateUsername } from "@/lib/validation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// One message for every failure path so we never reveal whether it was the
// identifier or the password that was wrong (nor whether the account exists).
const LOGIN_ERROR = "Incorrect email/username or password.";

/**
 * Log in with either an email or a username. An email authenticates directly;
 * a username is first resolved to the account's email. That lookup reads
 * auth.users (which the anon client can't see) via the service role and runs
 * only on the server — the email is never returned to the client.
 */
export async function signIn(input: {
  identifier: string;
  password: string;
}): Promise<{ error?: string; message?: string }> {
  const identifier = input.identifier.trim();
  if (!identifier || !input.password) return { error: LOGIN_ERROR };

  const supabase = await createClient();

  let email = identifier;
  if (!EMAIL_RE.test(identifier)) {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", identifier.toLowerCase())
      .maybeSingle();
    if (!profile) return { error: LOGIN_ERROR };

    const { data: found, error: lookupError } =
      await admin.auth.admin.getUserById(profile.id as string);
    if (lookupError || !found.user?.email) return { error: LOGIN_ERROR };
    email = found.user.email;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) return { error: LOGIN_ERROR };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(input: {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}): Promise<{ error?: string; message?: string }> {
  const username = normalizeUsername(input.username);

  const usernameError = validateUsername(username);
  if (usernameError) return { error: usernameError };
  if (input.password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();

  // Friendly pre-check; the unique index is the real guard.
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) return { error: "That username is already taken." };

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        username,
        display_name: (input.displayName ?? "").trim() || username,
      },
    },
  });
  if (error) return { error: error.message };

  // Email confirmation disabled → we have a session immediately.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  // Email confirmation enabled.
  return {
    message:
      "Account created! Check your email to confirm your address, then log in.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
