-- ============================================================================
-- TinyTweet — private accounts (approval-based following).
-- A private account's posts are visible only to accepted followers; following
-- one creates a pending request the owner approves or rejects. Safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists is_private boolean not null default false;

alter table public.follows
  add column if not exists status text not null default 'accepted';

do $$ begin
  alter table public.follows
    add constraint follows_status_check check (status in ('pending', 'accepted'));
exception when duplicate_object then null; end $$;

create index if not exists follows_following_status_idx
  on public.follows (following_id, status);

-- A follow to a PRIVATE account starts pending; public accounts auto-accept.
-- Set authoritatively here so a client can't self-approve by sending a status.
create or replace function public.set_follow_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select is_private from public.profiles where id = new.following_id) then
    new.status := 'pending';
  else
    new.status := 'accepted';
  end if;
  return new;
end;
$$;

drop trigger if exists follows_set_status on public.follows;
create trigger follows_set_status
  before insert on public.follows
  for each row execute function public.set_follow_status();

-- Approve / reject an incoming follow request (owner-scoped via auth.uid()).
create or replace function public.approve_follow(p_requester uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  update public.follows set status = 'accepted'
   where following_id = v_uid and follower_id = p_requester and status = 'pending';
  -- The request is resolved — clear its notification.
  delete from public.notifications
   where type = 'follow_request' and user_id = v_uid and actor_id = p_requester;
end;
$$;

create or replace function public.reject_follow(p_requester uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  delete from public.follows
   where following_id = v_uid and follower_id = p_requester and status = 'pending';
  delete from public.notifications
   where type = 'follow_request' and user_id = v_uid and actor_id = p_requester;
end;
$$;

-- Toggle the account's privacy. Going public accepts any outstanding requests
-- (anyone may follow now) and clears their request notifications.
create or replace function public.set_account_private(p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  update public.profiles set is_private = p_value where id = v_uid;
  if p_value = false then
    update public.follows set status = 'accepted'
     where following_id = v_uid and status = 'pending';
    delete from public.notifications
     where user_id = v_uid and type = 'follow_request';
  end if;
end;
$$;

-- Post visibility: a private account's posts are visible only to the owner and
-- ACCEPTED followers. Public accounts stay visible to all (subject to blocks).
--
-- The real logic lives in an INTERNAL function whose EXECUTE is revoked from the
-- API roles, so it can't be hit as POST /rpc/can_view_posts_internal to probe
-- can_view_posts(privateAccount, X) for arbitrary X and enumerate the approved-
-- follower graph. Our own SECURITY DEFINER policies/triggers reach it as the
-- function owner, so revoking API access doesn't affect them.
create or replace function public.can_view_posts_internal(p_author uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_viewer is not null and p_viewer = p_author then true
    when not coalesce((select is_private from public.profiles where id = p_author), false) then true
    when p_viewer is not null and exists (
      select 1 from public.follows
      where follower_id = p_viewer and following_id = p_author and status = 'accepted'
    ) then true
    else false
  end;
$$;
revoke execute on function public.can_view_posts_internal(uuid, uuid)
  from public, anon, authenticated;

-- Public wrapper used by the RLS policies, which always pass auth.uid() as the
-- viewer. The guard makes a DIRECT rpc caller able to ask only about themselves
-- (auth.uid() = p_viewer), never about a third party -- so it can't be used as
-- a follow-graph oracle. `is distinct from` (not `=`) keeps an anon policy call,
-- where auth.uid() and p_viewer are both null, evaluating normally.
create or replace function public.can_view_posts(p_author uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is distinct from p_viewer then false
    else public.can_view_posts_internal(p_author, p_viewer)
  end;
$$;

-- Aggregate profile counts are non-sensitive numbers, but the row-level
-- policies (posts/follows) deliberately hide the underlying posts and follow
-- edges from non-approved viewers -- which would make per-viewer count(*)
-- queries wrong (a public account would even undercount its private followers).
-- Compute them with definer rights so the displayed totals are accurate and
-- viewer-independent, while the lists themselves stay hidden ("private account:
-- counts shown, content hidden").
create or replace function public.get_profile_counts(p_profile uuid)
returns table (followers_count bigint, following_count bigint, posts_count bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.follows
       where following_id = p_profile and status = 'accepted'),
    (select count(*) from public.follows
       where follower_id = p_profile and status = 'accepted'),
    (select count(*) from public.posts where user_id = p_profile);
$$;

-- Directional "does p_author block p_recipient", read with definer rights so
-- trigger code (where auth.uid() is the actor, not the post author) can gate on
-- it. Mirrors the block half of the posts SELECT policy.
create or replace function public.author_blocks(p_author uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where blocker_id = p_author and blocked_id = p_recipient
  );
$$;
-- Only our SECURITY DEFINER triggers call this (as the owner); revoke API access
-- so it can't be used as POST /rpc/author_blocks to enumerate the block graph.
revoke execute on function public.author_blocks(uuid, uuid)
  from public, anon, authenticated;

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts for select
  using (
    not public.is_blocked_by(user_id, auth.uid())
    and public.can_view_posts(user_id, auth.uid())
  );

-- Post-derived content must inherit the post's visibility, or a private
-- account's poll options / replies / likes leak through PostgREST even though
-- the post body is hidden. A reply/like is visible exactly when its post is
-- visible -- this matches the denormalized reply_count/like_count and the
-- privacy-blind reply/like notifications, which a per-viewer actor gate never
-- could. (A private user's activity ON OTHER public posts is intentionally not
-- hidden; the privacy guarantee is about a private account's OWN posts.)
drop policy if exists "replies_select_all" on public.replies;
drop policy if exists "replies_select_visible" on public.replies;
create policy "replies_select_visible" on public.replies for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = replies.post_id
        and not public.is_blocked_by(p.user_id, auth.uid())
        and public.can_view_posts(p.user_id, auth.uid())
    )
  );

drop policy if exists "likes_select_all" on public.likes;
drop policy if exists "likes_select_visible" on public.likes;
create policy "likes_select_visible" on public.likes for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = likes.post_id
        and not public.is_blocked_by(p.user_id, auth.uid())
        and public.can_view_posts(p.user_id, auth.uid())
    )
  );

drop policy if exists "polls_select_all" on public.polls;
drop policy if exists "polls_select_visible" on public.polls;
create policy "polls_select_visible" on public.polls for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = polls.post_id
        and not public.is_blocked_by(p.user_id, auth.uid())
        and public.can_view_posts(p.user_id, auth.uid())
    )
  );

drop policy if exists "poll_options_select_all" on public.poll_options;
drop policy if exists "poll_options_select_visible" on public.poll_options;
create policy "poll_options_select_visible" on public.poll_options for select
  using (
    exists (
      select 1
      from public.polls pl
      join public.posts p on p.id = pl.post_id
      where pl.id = poll_options.poll_id
        and not public.is_blocked_by(p.user_id, auth.uid())
        and public.can_view_posts(p.user_id, auth.uid())
    )
  );

-- follows visibility: the two parties always see their own row (pending or
-- accepted). Any other viewer sees an accepted row ONLY when both endpoints are
-- publicly viewable, so a private account's follower/following graph (core
-- privacy metadata, and what can_view_posts itself is built on) is hidden from
-- non-approved viewers -- matching post visibility. can_view_posts is SECURITY
-- DEFINER and reads follows directly, so this policy does not recurse.
drop policy if exists "follows_select_all" on public.follows;
drop policy if exists "follows_select_visible" on public.follows;
create policy "follows_select_visible" on public.follows for select
  using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or (
      status = 'accepted'
      and public.can_view_posts(following_id, auth.uid())
      and public.can_view_posts(follower_id, auth.uid())
    )
  );

-- Allow the new follow_request notification type.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('follow', 'follow_request', 'like', 'reply', 'mention'));

-- notify_follow now distinguishes a pending request from an accepted follow.
create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.follower_id <> new.following_id then
    -- A follow request is actionable (must be approved), so it always notifies;
    -- only the passive 'accepted follow' honors the notification preference.
    if new.status = 'pending' then
      insert into public.notifications (user_id, type, actor_id, reference_id)
      values (new.following_id, 'follow_request', new.follower_id, null);
    elsif public.wants_notification(new.following_id, 'follow') then
      insert into public.notifications (user_id, type, actor_id, reference_id)
      values (new.following_id, 'follow', new.follower_id, null);
    end if;
  elsif tg_op = 'DELETE' then
    delete from public.notifications
     where type in ('follow', 'follow_request')
       and user_id = old.following_id
       and actor_id = old.follower_id;
  end if;
  return null;
end;
$$;

-- A mention lives inside a post/reply, so it must inherit that post's
-- visibility: don't notify (and dead-end) a recipient who can't see the post
-- the mention is in -- e.g. an @mention authored in a private account's post.
-- The reply/like-to-author notifications are unchanged: the author always sees
-- their own post. Otherwise identical to 0012.
create or replace function public.notify_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
  mentioned_username text;
  mentioned_id uuid;
begin
  select user_id into post_author from public.posts where id = new.post_id;

  if post_author is not null and post_author <> new.user_id
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

create or replace function public.notify_post_mention()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mentioned_username text;
  mentioned_id uuid;
begin
  for mentioned_username in
    select distinct lower(t.arr[1])
    from regexp_matches(new.content, '@([A-Za-z0-9_]+)', 'g') as t(arr)
  loop
    select id into mentioned_id from public.profiles where username = mentioned_username;
    if mentioned_id is not null and mentioned_id <> new.user_id
       and public.can_view_posts_internal(new.user_id, mentioned_id)
       and not public.author_blocks(new.user_id, mentioned_id)
       and public.wants_notification(mentioned_id, 'mention') then
      insert into public.notifications (user_id, type, actor_id, reference_id)
      values (mentioned_id, 'mention', new.user_id, new.id);
    end if;
  end loop;
  return null;
end;
$$;

-- create_conversation: the DM-privacy 'following' check must require an ACCEPTED
-- follow (a pending request doesn't count). Otherwise unchanged from 0012.
create or replace function public.create_conversation(
  target_ids uuid[],
  is_group_in boolean,
  group_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me         uuid := auth.uid();
  all_ids    uuid[];
  conv_id    uuid;
  existing   uuid;
  make_group boolean;
  t          uuid;
  priv       text;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if target_ids is null or array_length(target_ids, 1) is null then
    raise exception 'No recipients';
  end if;

  all_ids := (select array_agg(distinct x) from unnest(array_append(target_ids, me)) as x);
  make_group := coalesce(is_group_in, false) or array_length(all_ids, 1) > 2;

  if not make_group and array_length(all_ids, 1) = 2 then
    select c.id into existing
    from public.conversations c
    where c.is_group = false
      and (select count(*) from public.conversation_participants p where p.conversation_id = c.id) = 2
      and exists (select 1 from public.conversation_participants p where p.conversation_id = c.id and p.user_id = all_ids[1])
      and exists (select 1 from public.conversation_participants p where p.conversation_id = c.id and p.user_id = all_ids[2])
    limit 1;
    if existing is not null then return existing; end if;
  end if;

  for t in select distinct x from unnest(target_ids) as x where x <> me loop
    if public.is_blocked_by(t, me) or public.is_blocked_by(me, t) then
      raise exception 'You cannot message this user.' using errcode = 'check_violation';
    end if;
    if not make_group then
      select dm_privacy into priv from public.profiles where id = t;
      if priv = 'none' then
        raise exception 'This user is not accepting messages.' using errcode = 'check_violation';
      elsif priv = 'following'
        and not exists (
          select 1 from public.follows
          where follower_id = t and following_id = me and status = 'accepted'
        ) then
        raise exception 'This user only accepts messages from people they follow.'
          using errcode = 'check_violation';
      end if;
    end if;
  end loop;

  insert into public.conversations (is_group, name, created_by)
  values (make_group, case when make_group then nullif(trim(coalesce(group_name, '')), '') else null end, me)
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  select conv_id, x from unnest(all_ids) as x;

  return conv_id;
end;
$$;

notify pgrst, 'reload schema';
