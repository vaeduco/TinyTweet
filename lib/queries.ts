import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Conversation,
  ConversationWithMeta,
  Database,
  MessageWithSender,
  NotificationWithActor,
  Poll,
  PollOption,
  PollWithMeta,
  Post,
  PostWithAuthor,
  Profile,
  ProfileWithStats,
  Reply,
  ReplyWithAuthor,
} from "@/lib/types";
import { extractHashtags } from "@/lib/parse";

type Client = SupabaseClient<Database>;

// Embed the author profile via the foreign key. Postgres names the constraint
// "<table>_<column>_fkey" by default, which is what these hints reference.
const POST_SELECT = "*, author:profiles!posts_user_id_fkey(*)";
const REPLY_SELECT = "*, author:profiles!replies_user_id_fkey(*)";

const FEED_LIMIT = 40;
const LIST_LIMIT = 50;
const SEARCH_LIMIT = 30;

type RawPost = Post & { author: Profile };

/** Strip characters that would break a PostgREST filter string. */
function sanitizeTerm(term: string): string {
  return term.trim().replace(/[,%()*\\:]/g, "");
}

/** Fetch polls (with options, the viewer's vote, and totals) for a batch of
 * posts, keyed by post id. Only posts that actually have a poll appear. */
async function fetchPollsForPosts(
  client: Client,
  postIds: string[],
  viewerId: string | null
): Promise<Map<string, PollWithMeta>> {
  const byPost = new Map<string, PollWithMeta>();
  if (postIds.length === 0) return byPost;

  const { data: pollRows } = await client
    .from("polls")
    .select("*")
    .in("post_id", postIds);
  const polls = (pollRows ?? []) as Poll[];
  if (polls.length === 0) return byPost;

  const pollIds = polls.map((p) => p.id);
  const { data: optionRows } = await client
    .from("poll_options")
    .select("*")
    .in("poll_id", pollIds)
    .order("position", { ascending: true });
  const options = (optionRows ?? []) as PollOption[];

  const myVoteByPoll = new Map<string, string>();
  if (viewerId) {
    const { data: voteRows } = await client
      .from("poll_votes")
      .select("poll_id, option_id")
      .eq("user_id", viewerId)
      .in("poll_id", pollIds);
    for (const v of (voteRows ?? []) as { poll_id: string; option_id: string }[]) {
      myVoteByPoll.set(v.poll_id, v.option_id);
    }
  }

  const optionsByPoll = new Map<string, PollOption[]>();
  for (const o of options) {
    const arr = optionsByPoll.get(o.poll_id) ?? [];
    arr.push(o);
    optionsByPoll.set(o.poll_id, arr);
  }

  for (const poll of polls) {
    const opts = optionsByPoll.get(poll.id) ?? [];
    byPost.set(poll.post_id, {
      ...poll,
      options: opts,
      my_vote_option_id: myVoteByPoll.get(poll.id) ?? null,
      total_votes: opts.reduce((sum, o) => sum + o.vote_count, 0),
    });
  }

  return byPost;
}

/** Attach the viewer's `liked_by_me` / `saved_by_me` flags plus any poll to a
 * batch of posts. */
async function withViewerMeta(
  client: Client,
  rows: RawPost[],
  viewerId: string | null
): Promise<PostWithAuthor[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Polls are viewer-independent except for the viewer's own vote, so fetch
  // them concurrently with the like/save flags.
  const pollsPromise = fetchPollsForPosts(client, ids, viewerId);

  let liked = new Set<string>();
  let saved = new Set<string>();
  if (viewerId) {
    const [{ data: likeRows }, { data: savedRows }] = await Promise.all([
      client.from("likes").select("post_id").eq("user_id", viewerId).in("post_id", ids),
      client.from("saved_posts").select("post_id").eq("user_id", viewerId).in("post_id", ids),
    ]);
    liked = new Set((likeRows ?? []).map((l) => l.post_id));
    saved = new Set((savedRows ?? []).map((s) => s.post_id));
  }

  const pollsByPost = await pollsPromise;

  return rows.map((r) => ({
    ...r,
    liked_by_me: liked.has(r.id),
    saved_by_me: saved.has(r.id),
    poll: pollsByPost.get(r.id) ?? null,
  }));
}

export async function getFollowingIds(
  client: Client,
  userId: string
): Promise<string[]> {
  const { data } = await client
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  return (data ?? []).map((f) => f.following_id);
}

/** Home feed: own posts + followed users, reverse-chronological. */
export async function getFeed(
  client: Client,
  userId: string
): Promise<{ posts: PostWithAuthor[]; relevantAuthorIds: string[] }> {
  const followingIds = await getFollowingIds(client, userId);
  const authorIds = [userId, ...followingIds];

  const { data, error } = await client
    .from("posts")
    .select(POST_SELECT)
    .in("user_id", authorIds)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);

  if (error) throw error;

  const posts = await withViewerMeta(
    client,
    (data ?? []) as unknown as RawPost[],
    userId
  );
  return { posts, relevantAuthorIds: authorIds };
}

export async function getUserPosts(
  client: Client,
  profileId: string,
  viewerId: string | null
): Promise<PostWithAuthor[]> {
  const { data } = await client
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  return withViewerMeta(client, (data ?? []) as unknown as RawPost[], viewerId);
}

/** Posts the viewer has bookmarked, most-recently-saved first. */
export async function getSavedPosts(
  client: Client,
  userId: string
): Promise<PostWithAuthor[]> {
  const { data: savedRows } = await client
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  const ids = (savedRows ?? []).map((s) => s.post_id);
  if (ids.length === 0) return [];

  const { data } = await client.from("posts").select(POST_SELECT).in("id", ids);

  // posts.in() doesn't preserve order — restore the saved (recency) order.
  const byId = new Map(
    ((data ?? []) as unknown as RawPost[]).map((r) => [r.id, r])
  );
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((r): r is RawPost => !!r);

  return withViewerMeta(client, ordered, userId);
}

export async function getPost(
  client: Client,
  postId: string,
  viewerId: string | null
): Promise<PostWithAuthor | null> {
  const { data } = await client
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .maybeSingle();

  if (!data) return null;
  const [post] = await withViewerMeta(
    client,
    [data as unknown as RawPost],
    viewerId
  );
  return post ?? null;
}

export async function getReplies(
  client: Client,
  postId: string
): Promise<ReplyWithAuthor[]> {
  const { data } = await client
    .from("replies")
    .select(REPLY_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  return (data ?? []) as unknown as ReplyWithAuthor[];
}

export async function getProfileByUsername(
  client: Client,
  username: string
): Promise<Profile | null> {
  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function getProfileWithStats(
  client: Client,
  profile: Profile,
  viewerId: string | null
): Promise<ProfileWithStats> {
  const [followers, following, postsCount] = await Promise.all([
    client
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    client
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    client
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id),
  ]);

  let followed_by_me = false;
  let blocked_by_me = false;
  if (viewerId && viewerId !== profile.id) {
    const [{ data: followRow }, { data: blockRow }] = await Promise.all([
      client
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewerId)
        .eq("following_id", profile.id)
        .maybeSingle(),
      client
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", viewerId)
        .eq("blocked_id", profile.id)
        .maybeSingle(),
    ]);
    followed_by_me = !!followRow;
    blocked_by_me = !!blockRow;
  }

  return {
    ...profile,
    followers_count: followers.count ?? 0,
    following_count: following.count ?? 0,
    posts_count: postsCount.count ?? 0,
    followed_by_me,
    blocked_by_me,
  };
}

/** Profiles the viewer has blocked (for the settings block list). */
export async function getBlockedProfiles(
  client: Client,
  userId: string
): Promise<Profile[]> {
  const { data: rows } = await client
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  const ids = (rows ?? []).map((r) => r.blocked_id);
  if (ids.length === 0) return [];

  const { data } = await client.from("profiles").select("*").in("id", ids);
  // .in() doesn't preserve order — restore the block recency order.
  const byId = new Map(((data ?? []) as Profile[]).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Profile => !!p);
}

export async function searchUsers(
  client: Client,
  query: string
): Promise<Profile[]> {
  const term = sanitizeTerm(query);
  if (!term) return [];

  const { data } = await client
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .limit(SEARCH_LIMIT);

  return (data ?? []) as Profile[];
}

export async function searchPosts(
  client: Client,
  query: string,
  viewerId: string | null
): Promise<PostWithAuthor[]> {
  const term = sanitizeTerm(query);
  if (!term) return [];

  const { data } = await client
    .from("posts")
    .select(POST_SELECT)
    .ilike("content", `%${term}%`)
    .order("created_at", { ascending: false })
    .limit(SEARCH_LIMIT);

  return withViewerMeta(client, (data ?? []) as unknown as RawPost[], viewerId);
}

/** Posts containing an exact #hashtag (case-insensitive). */
export async function getHashtagPosts(
  client: Client,
  tag: string,
  viewerId: string | null
): Promise<PostWithAuthor[]> {
  const safe = tag.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!safe) return [];

  // Exact, case-insensitive, word-boundary hashtag match applied IN THE DATABASE
  // so the LIMIT selects genuine #tag posts and superset tags (e.g. #json for
  // "js") can't evict them. `safe` is sanitized to [a-z0-9_] so it carries no
  // regex metacharacters. imatch => POSIX `~*`.
  const { data } = await client
    .from("posts")
    .select(POST_SELECT)
    .filter("content", "imatch", `(^|[^a-zA-Z0-9_])#${safe}([^a-zA-Z0-9_]|$)`)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  // Safety net in case of any regex edge case: keep only exact hashtag matches.
  const rows = ((data ?? []) as unknown as RawPost[]).filter((p) =>
    extractHashtags(p.content).includes(safe)
  );

  return withViewerMeta(client, rows, viewerId);
}

// ---- Discovery (right sidebar): trending hashtags & who-to-follow ----

export type TrendingHashtag = { tag: string; count: number };

/** Top hashtags by number of posts using them within the last `hours`. */
export async function getTrendingHashtags(
  client: Client,
  { hours = 24, limit = 6 }: { hours?: number; limit?: number } = {}
): Promise<TrendingHashtag[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data } = await client
    .from("posts")
    .select("content, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const posts = data ?? [];
  const recent = posts.filter((p) => p.created_at >= since);
  // Fall back to all recently-fetched posts if nothing is in the window yet.
  const pool = recent.length > 0 ? recent : posts;

  const counts = new Map<string, number>();
  for (const p of pool) {
    for (const tag of extractHashtags(p.content)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Suggested profiles the viewer doesn't already follow (newest first). */
export async function getWhoToFollow(
  client: Client,
  viewerId: string | null,
  limit = 3
): Promise<Profile[]> {
  const exclude = new Set<string>();
  if (viewerId) {
    exclude.add(viewerId);
    for (const id of await getFollowingIds(client, viewerId)) exclude.add(id);
  }

  // Over-fetch a small batch and filter self/followed in JS, so the exclude
  // set is never serialized into the request URL (an unbounded `not.in` filter
  // can overflow the URL and silently return nothing for very active users).
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];

  return ((data ?? []) as Profile[])
    .filter((p) => !exclude.has(p.id))
    .slice(0, limit);
}

// ---- Notifications ----

const NOTIFICATION_SELECT =
  "*, actor:profiles!notifications_actor_id_fkey(*)";

export async function getNotifications(
  client: Client,
  userId: string,
  limit = 30
): Promise<NotificationWithActor[]> {
  const { data } = await client
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as unknown as NotificationWithActor[];
}

export async function getUnreadNotificationCount(
  client: Client,
  userId: string
): Promise<number> {
  const { count } = await client
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  return count ?? 0;
}

// ---- Messaging ----

function computeUnread(
  conv: Pick<
    Conversation,
    "last_message_at" | "last_message_preview" | "last_message_sender_id"
  >,
  viewerId: string,
  lastReadAt: string | undefined
): boolean {
  return (
    !!conv.last_message_preview &&
    conv.last_message_sender_id !== null &&
    conv.last_message_sender_id !== viewerId &&
    (!lastReadAt || conv.last_message_at > lastReadAt)
  );
}

/** The viewer's conversations, newest activity first, with members + unread flag. */
export async function getInbox(
  client: Client,
  userId: string
): Promise<ConversationWithMeta[]> {
  const { data: myParts } = await client
    .from("conversation_participants")
    .select(
      "conversation_id, last_read_at, is_archived, deleted_at, is_muted, is_pinned, pinned_at"
    )
    .eq("user_id", userId)
    .is("deleted_at", null);

  const parts = myParts ?? [];
  if (parts.length === 0) return [];

  const partByConv = new Map(parts.map((p) => [p.conversation_id, p]));
  const convIds = parts.map((p) => p.conversation_id);

  const [{ data: convData }, { data: memberRows }] = await Promise.all([
    client
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .order("last_message_at", { ascending: false }),
    client
      .from("conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds),
  ]);

  // Member profiles come from the conversation_members view (ids only) plus a
  // profiles lookup, so co-participants' private per-user flags stay unreadable
  // (those live on conversation_participants, which is now own-row only).
  const rows = (memberRows ?? []) as { conversation_id: string; user_id: string }[];
  const memberIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profData } = memberIds.length
    ? await client.from("profiles").select("*").in("id", memberIds)
    : { data: [] as Profile[] };
  const profById = new Map(((profData ?? []) as Profile[]).map((p) => [p.id, p]));

  const membersByConv = new Map<string, Profile[]>();
  for (const row of rows) {
    const profile = profById.get(row.user_id);
    if (!profile) continue;
    const arr = membersByConv.get(row.conversation_id) ?? [];
    arr.push(profile);
    membersByConv.set(row.conversation_id, arr);
  }

  return ((convData ?? []) as Conversation[]).map((c) => {
    const participants = membersByConv.get(c.id) ?? [];
    const mine = partByConv.get(c.id);
    return {
      ...c,
      participants,
      others: participants.filter((p) => p.id !== userId),
      unread: computeUnread(c, userId, mine?.last_read_at),
      is_archived: !!mine?.is_archived,
      is_muted: !!mine?.is_muted,
      is_pinned: !!mine?.is_pinned,
      pinned_at: mine?.pinned_at ?? null,
    };
  });
}

/** A single conversation the viewer belongs to (RLS returns null otherwise). */
export async function getConversationForViewer(
  client: Client,
  conversationId: string,
  userId: string
): Promise<{
  conversation: Conversation;
  participants: Profile[];
  others: Profile[];
} | null> {
  const { data: conv } = await client
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;

  const { data: memberRows } = await client
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  const memberIds = ((memberRows ?? []) as { user_id: string }[]).map(
    (r) => r.user_id
  );
  const { data: profData } = memberIds.length
    ? await client.from("profiles").select("*").in("id", memberIds)
    : { data: [] as Profile[] };
  const participants = (profData ?? []) as Profile[];

  return {
    conversation: conv as Conversation,
    participants,
    others: participants.filter((p) => p.id !== userId),
  };
}

export async function getMessages(
  client: Client,
  conversationId: string,
  limit = 100
): Promise<MessageWithSender[]> {
  // Fetch the newest `limit` messages, then reverse to chronological order.
  // (ORDER BY asc + LIMIT would return the OLDEST rows and hide recent activity.)
  const { data } = await client
    .from("messages")
    .select("*, sender:profiles!messages_sender_id_fkey(*)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as MessageWithSender[]).reverse();
}

/** People the viewer follows (for the "new message" search). */
export async function getFollowedProfiles(
  client: Client,
  userId: string,
  search?: string
): Promise<Profile[]> {
  const followingIds = await getFollowingIds(client, userId);
  if (followingIds.length === 0) return [];

  let query = client.from("profiles").select("*").in("id", followingIds);
  const term = search ? sanitizeTerm(search) : "";
  if (term) {
    query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
  }

  const { data } = await query.order("username").limit(50);
  return (data ?? []) as Profile[];
}

/** Conversation ids with unread messages (for the nav badge / provider seed). */
export async function getUnreadConversationIds(
  client: Client,
  userId: string
): Promise<string[]> {
  const { data: myParts } = await client
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_archived", false);

  const parts = myParts ?? [];
  if (parts.length === 0) return [];

  const lastReadByConv = new Map(parts.map((p) => [p.conversation_id, p.last_read_at]));
  const convIds = parts.map((p) => p.conversation_id);

  const { data: convData } = await client
    .from("conversations")
    .select("id, last_message_at, last_message_preview, last_message_sender_id")
    .in("id", convIds);

  const unread: string[] = [];
  for (const c of (convData ?? []) as (Pick<
    Conversation,
    "last_message_at" | "last_message_preview" | "last_message_sender_id"
  > & { id: string })[]) {
    if (computeUnread(c, userId, lastReadByConv.get(c.id))) unread.push(c.id);
  }
  return unread;
}

/** Conversation ids the viewer has muted (for the nav-badge suppression). */
export async function getMutedConversationIds(
  client: Client,
  userId: string
): Promise<string[]> {
  const { data } = await client
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId)
    .eq("is_muted", true)
    .is("deleted_at", null);
  return (data ?? []).map((p) => p.conversation_id);
}
