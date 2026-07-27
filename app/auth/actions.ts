"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, validateUsername } from "@/lib/validation";

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<{ error?: string; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) return { error: error.message };

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
