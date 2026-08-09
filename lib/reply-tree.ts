import type { ReplyWithAuthor } from "@/lib/types";

/** A reply plus its nested child replies, built from the flat list. */
export type ReplyNode = ReplyWithAuthor & { children: ReplyNode[] };

/**
 * Turn a flat, chronologically-sorted list of replies into a tree keyed by
 * `parent_reply_id`. A reply with a null parent — or one whose parent isn't in
 * the set (e.g. a since-deleted comment) — becomes a top-level root. Sibling
 * order follows the input order, so passing an oldest-first list keeps each
 * thread oldest-first.
 */
export function buildReplyTree(replies: ReplyWithAuthor[]): ReplyNode[] {
  const byId = new Map<string, ReplyNode>();
  for (const r of replies) byId.set(r.id, { ...r, children: [] });

  const roots: ReplyNode[] = [];
  for (const r of replies) {
    const node = byId.get(r.id)!;
    const parent = r.parent_reply_id ? byId.get(r.parent_reply_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
