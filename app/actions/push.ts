"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Endpoint is globally unique; a device that re-subscribes (or a different
// account signing in on the same browser) reuses it. Reassign it to the current
// user with the service role so the endpoint-unique upsert can't be blocked by
// another owner's row — the user_id is always the verified session user.
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// The endpoint is later fetched server-side by the Edge Function, so a stored
// endpoint is an SSRF vector. Accept only https URLs on known push services —
// never an arbitrary/internal host.
const ALLOWED_PUSH_HOSTS = [
  ".googleapis.com", // FCM (Chrome/Android)
  ".push.services.mozilla.com", // Firefox
  ".push.apple.com", // Safari (web.push.apple.com)
  ".notify.windows.com", // WNS (Edge)
  ".push.microsoft.com",
];

function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOSTS.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
  );
}

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  if (!isAllowedPushEndpoint(input.endpoint)) {
    return { error: "Unsupported push endpoint." };
  }

  const { error } = await admin()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent ?? null,
      },
      { onConflict: "endpoint" }
    );
  if (error) return { error: error.message };
  return {};
}

export async function deletePushSubscription(
  endpoint: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Own-only via the session client (RLS) — a user can only remove their own.
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}
