// Supabase Edge Function (Deno). Invoked by Database Webhooks on INSERT into
// `notifications` and `messages`; sends Web Push to the recipient's devices.
//
// Deploy:  supabase functions deploy push-notify --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
//            VAPID_SUBJECT=mailto:you@example.com WEBHOOK_SECRET=<random>
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by default.)
//
// Webhooks: create two Database Webhooks (Supabase dashboard) — one on
//   public.notifications (INSERT), one on public.messages (INSERT) — both
//   POSTing to this function's URL with header `x-webhook-secret: <WEBHOOK_SECRET>`.
//
// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@tinytweet.app";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

const PUSH_CONFIGURED = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (PUSH_CONFIGURED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Mirror of lib/notification-text.ts (kept in sync by hand).
function notificationText(
  type: string,
  name: string,
  username: string,
  referenceId: string | null
): { body: string; url: string } {
  const postUrl = referenceId ? `/post/${referenceId}` : "/notifications";
  switch (type) {
    case "follow":
      return { body: `${name} followed you`, url: `/${username}` };
    case "follow_request":
      return { body: `${name} requested to follow you`, url: "/follow-requests" };
    case "like":
      return { body: `${name} liked your post`, url: postUrl };
    case "reply":
      return { body: `${name} replied to your post`, url: postUrl };
    case "mention":
      return { body: `${name} mentioned you`, url: postUrl };
    default:
      return { body: `${name} sent you a notification`, url: "/notifications" };
  }
}

async function sendToUser(userId: string, payload: Record<string, unknown>) {
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  await Promise.all(
    (subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        // 404/410 = the subscription is gone; prune it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );
}

Deno.serve(async (req) => {
  // Fail CLOSED: an unset secret must never disable the gate (that would make
  // this a public, unauthenticated push relay).
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!PUSH_CONFIGURED) {
    return new Response("push not configured", { status: 200 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const { table, type, record } = payload ?? {};
  if (type !== "INSERT" || !record) return new Response("ignored", { status: 200 });

  if (table === "notifications") {
    // The row only exists because the trigger already honored the recipient's
    // per-type preference, so no re-check is needed here.
    if (record.user_id === record.actor_id) return new Response("self", { status: 200 });
    const { data: actor } = await admin
      .from("profiles")
      .select("username, display_name")
      .eq("id", record.actor_id)
      .single();
    const name = actor ? actor.display_name || actor.username : "Someone";
    const { body, url } = notificationText(
      record.type,
      name,
      actor?.username ?? "",
      record.reference_id
    );
    await sendToUser(record.user_id, {
      title: "TinyTweet",
      body,
      url,
      tag: `notif-${record.id}`,
    });
    return new Response("ok", { status: 200 });
  }

  if (table === "messages") {
    const convId = record.conversation_id;
    const senderId = record.sender_id;
    const { data: sender } = await admin
      .from("profiles")
      .select("username, display_name")
      .eq("id", senderId)
      .single();
    const name = sender ? sender.display_name || sender.username : "Someone";

    const { data: parts } = await admin
      .from("conversation_participants")
      .select("user_id, is_muted, deleted_at")
      .eq("conversation_id", convId);

    await Promise.all(
      (parts ?? [])
        .filter(
          (p: any) => p.user_id !== senderId && !p.is_muted && !p.deleted_at
        )
        .map((p: any) =>
          sendToUser(p.user_id, {
            title: "TinyTweet",
            body: `New message from ${name}`,
            url: `/messages/${convId}`,
            tag: `msg-${convId}`,
          })
        )
    );
    return new Response("ok", { status: 200 });
  }

  return new Response("ignored", { status: 200 });
});
