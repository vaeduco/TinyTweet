import type { NotificationWithActor } from "@/lib/types";

/**
 * Human-readable text + destination for a notification, shared by the in-app
 * toast and (mirrored) the push Edge Function. The URL is where tapping the
 * alert should land.
 */
export function notificationText(n: NotificationWithActor): {
  body: string;
  url: string;
} {
  const name = n.actor.display_name || n.actor.username;
  const postUrl = n.reference_id ? `/post/${n.reference_id}` : "/notifications";
  switch (n.type) {
    case "follow":
      return { body: `${name} followed you`, url: `/${n.actor.username}` };
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
