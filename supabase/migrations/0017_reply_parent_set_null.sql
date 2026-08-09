-- ============================================================================
-- TinyTweet — preserve nested replies when a parent reply is deleted.
--
-- The self-referential FK on replies.parent_reply_id was ON DELETE CASCADE, so
-- deleting your own reply hard-deleted every reply nested beneath it — including
-- OTHER users' replies (FK cascades run as the table owner and bypass the
-- owner-only delete RLS). The threaded-replies UI makes such mixed-authorship
-- subtrees common, turning that into silent cross-user data loss.
--
-- Switch to ON DELETE SET NULL: deleting a reply re-parents its children to the
-- post itself (parent_reply_id -> null), so they survive as top-level replies.
-- buildReplyTree already re-roots any reply whose parent isn't present.
--
-- Idempotent: drop-if-exists then re-add, so a re-run just reasserts SET NULL.
-- ============================================================================

alter table public.replies
  drop constraint if exists replies_parent_reply_id_fkey;

alter table public.replies
  add constraint replies_parent_reply_id_fkey
    foreign key (parent_reply_id)
    references public.replies (id)
    on delete set null;

notify pgrst, 'reload schema';
