-- ============================================================================
-- TinyTweet — gate reply INSERT on post visibility + blocks.
--
-- replies_insert_owner (0001) only checked auth.uid() = user_id, so via a direct
-- PostgREST call a user could insert a reply onto a post they can't view (a
-- private account they don't follow) or one whose author has blocked them — and
-- the author would still get a 'reply' notification. Every other interaction
-- insert (follows, messages, mentions) already enforces blocks; this closes the
-- gap for replies, mirroring the replies_select_visible SELECT policy: you can
-- reply to a post exactly when you can see it and aren't blocked.
--
-- Uses the guarded public wrappers is_blocked_by / can_view_posts, called with
-- auth.uid() as the viewer just like the SELECT policies, so the SECURITY
-- DEFINER oracle guards pass transparently.
--
-- Idempotent: drop-if-exists then recreate.
-- ============================================================================

drop policy if exists "replies_insert_owner" on public.replies;
create policy "replies_insert_owner" on public.replies
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.posts p
      where p.id = replies.post_id
        and not public.is_blocked_by(p.user_id, auth.uid())
        and public.can_view_posts(p.user_id, auth.uid())
    )
  );

-- Defense-in-depth: also refuse the author's 'reply' notification when the
-- author has blocked the replier, mirroring the @mention branch's block check.
-- (With the insert policy above a blocked user can no longer insert at all, so
-- this never fires in practice — but it keeps the trigger correct if the policy
-- is ever loosened, and matches how the mention branch already guards.)
-- Visibility is intentionally NOT re-checked here: reply notifications stay
-- privacy-blind by design (the author always sees their own post's reply_count),
-- and the insert policy already blocks non-viewers. Otherwise identical to 0013.
create or replace function public.notify_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
  mentioned_username text;
  mentioned_id uuid;
begin
  select user_id into post_author from public.posts where id = new.post_id;

  if post_author is not null and post_author <> new.user_id
     and not public.author_blocks(post_author, new.user_id)
     and public.wants_notification(post_author, 'reply') then
    insert into public.notifications (user_id, type, actor_id, reference_id, reply_id)
    values (post_author, 'reply', new.user_id, new.post_id, new.id);
  end if;

  for mentioned_username in
    select distinct lower(t.arr[1])
    from regexp_matches(new.content, '@([A-Za-z0-9_]+)', 'g') as t(arr)
  loop
    select id into mentioned_id from public.profiles where username = mentioned_username;
    if mentioned_id is not null
       and mentioned_id <> new.user_id
       and (post_author is null or mentioned_id <> post_author)
       and public.can_view_posts_internal(post_author, mentioned_id)
       and not public.author_blocks(post_author, mentioned_id)
       and public.wants_notification(mentioned_id, 'mention') then
      insert into public.notifications (user_id, type, actor_id, reference_id, reply_id)
      values (mentioned_id, 'mention', new.user_id, new.post_id, new.id);
    end if;
  end loop;

  return null;
end;
$$;

notify pgrst, 'reload schema';
