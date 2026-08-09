import type { ReplyWithAuthor } from "@/lib/types";

/**
 * A top-level comment plus the single flat list of every reply beneath it.
 * Threading is capped at ONE level: replies never nest further, so a thread is
 * just the comment and its replies rendered together, indented once.
 */
export type ReplyThread = {
  comment: ReplyWithAuthor;
  replies: ReplyWithAuthor[];
};

/**
 * Group a flat, chronologically-sorted (oldest-first) reply list into threads.
 * A reply with a null parent — or one whose parent isn't in the set (e.g. a
 * since-deleted comment) — is a top-level comment. Every other reply is folded
 * into its TOP-LEVEL ancestor's thread, so any legacy deeper nesting collapses
 * to a single flat level. Input order is preserved: comments oldest-first, and
 * each thread's replies oldest-first.
 */
export function buildReplyThreads(replies: ReplyWithAuthor[]): ReplyThread[] {
  const byId = new Map<string, ReplyWithAuthor>();
  for (const r of replies) byId.set(r.id, r);

  const isRoot = (r: ReplyWithAuthor) =>
    !r.parent_reply_id || !byId.has(r.parent_reply_id);

  // Walk up parent links to the top-level ancestor (guarded against cycles).
  const rootOf = (r: ReplyWithAuthor): ReplyWithAuthor => {
    let cur = r;
    const seen = new Set<string>();
    while (!isRoot(cur) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parent_reply_id!)!;
    }
    return cur;
  };

  const threads = new Map<string, ReplyThread>();
  const order: string[] = [];

  for (const r of replies) {
    if (isRoot(r)) {
      threads.set(r.id, { comment: r, replies: [] });
      order.push(r.id);
    }
  }
  for (const r of replies) {
    if (isRoot(r)) continue;
    const thread = threads.get(rootOf(r).id);
    if (thread) {
      thread.replies.push(r);
    } else {
      // Only reachable if the parent chain contains a cycle (not possible via
      // the app, since parent_reply_id is write-once to an older reply). Surface
      // the reply as its own top-level thread rather than silently dropping it.
      threads.set(r.id, { comment: r, replies: [] });
      order.push(r.id);
    }
  }

  return order.map((id) => threads.get(id)!);
}
