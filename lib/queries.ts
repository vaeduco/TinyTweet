import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
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

/** Attach `liked_by_me` to a batch of posts with a single likes query. */
async function withLiked(
  client: Client,
  rows: RawPost[],
  viewerId: string | null
): Promise<PostWithAuthor[]> {
  if (rows.length === 0) return [];

  let liked = new Set<string>();
  if (viewerId) {
    const ids = rows.map((r) => r.id);
    const { data } = await client
      .from("likes")
      .select("post_id")
      .eq("user_id", viewerId)
      .in("post_id", ids);
    liked = new Set((data ?? []).map((l) => l.post_id));
  }

  return rows.map((r) => ({ ...r, liked_by_me: liked.has(r.id) }));
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

  const posts = await withLiked(
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

  return withLiked(client, (data ?? []) as unknown as RawPost[], viewerId);
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
  const [post] = await withLiked(
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
  if (viewerId && viewerId !== profile.id) {
    const { data } = await client
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId)
      .eq("following_id", profile.id)
      .maybeSingle();
    followed_by_me = !!data;
  }

  return {
    ...profile,
    followers_count: followers.count ?? 0,
    following_count: following.count ?? 0,
    posts_count: postsCount.count ?? 0,
    followed_by_me,
  };
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

  return withLiked(client, (data ?? []) as unknown as RawPost[], viewerId);
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

  return withLiked(client, rows, viewerId);
}
