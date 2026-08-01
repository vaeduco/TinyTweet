-- ============================================================================
-- TinyTweet — settings: blocks, notification preferences, DM privacy.
-- (Private-account / approval-based following is intentionally NOT included.)
-- Safe to re-run.
-- ============================================================================

-- Profile preference columns -------------------------------------------------
alter table public.profiles
  add column if not exists notify_follows  boolean not null default true,
  add column if not exists notify_likes    boolean not null default true,
  add column if not exists notify_replies  boolean not null default true,
  add column if not exists notify_mentions boolean not null default true,
  add column if not exists dm_privacy       text    not null default 'everyone';

do $$ begin
  alter table public.profiles
    add constraint profiles_dm_privacy_check
    check (dm_privacy in ('everyone', 'following', 'none'));
exception when duplicate_object then null; end $$;

-- Blocks ---------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- The blocker manages their own rows (list + unblock). The blocked party never
-- reads these — enforcement goes through the SECURITY DEFINER helper below.
drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks for select
  using (blocker_id = auth.uid());
drop policy if exists "blocks_insert_self" on public.blocks;
create policy "blocks_insert_self" on public.blocks for insert
  with check (blocker_id = auth.uid());
drop policy if exists "blocks_delete_self" on public.blocks;
create policy "blocks_delete_self" on public.blocks for delete
  using (blocker_id = auth.uid());

-- Directional block check (does p_owner block p_viewer?), bypassing RLS so it
-- can gate other tables. Directional so a blocker can still read the profiles
-- of people they blocked (for the block list); the blocked party is the one cut off.
create or replace function public.is_blocked_by(p_owner uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Only answer for a party in the pair, so this can't be used as a public
  -- oracle (POST /rpc/is_blocked_by) to enumerate the block graph. Every policy
  -- / definer caller passes auth.uid() as one argument, so this is transparent
  -- to them; a direct anon call with arbitrary ids matches neither and gets false.
  select case
    when auth.uid() = p_owner or auth.uid() = p_viewer then exists (
      select 1 from public.blocks
      where blocker_id = p_owner and blocked_id = p_viewer
    )
    else false
  end;
$$;

-- Block + drop any follow relationship in either direction, atomically.
create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;
  if v_uid = p_target then
    raise exception 'You cannot block yourself.' using errcode = 'check_violation';
  end if;
  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_target)
  on conflict do nothing;
  delete from public.follows
   where (follower_id = v_uid and following_id = p_target)
      or (follower_id = p_target and following_id = v_uid);
end;
$$;

-- Per-user notification preference lookup (used by the notify triggers).
create or replace function public.wants_notification(p_user uuid, p_type text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v boolean;
begin
  select case p_type
    when 'follow'  then notify_follows
    when 'like'    then notify_likes
    when 'reply'   then notify_replies
    when 'mention' then notify_mentions
    else true
  end into v
  from public.profiles where id = p_user;
  return coalesce(v, true);
end;
$$;

-- Enforce blocks on core visibility + following ------------------------------
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select
  using (
    -- Blocked users can't see the blocker, but a blocker can always read the
    -- profiles of people THEY blocked (so the block list works, even mutually).
    not public.is_blocked_by(id, auth.uid())
    or public.is_blocked_by(auth.uid(), id)
  );

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts for select
  using (not public.is_blocked_by(user_id, auth.uid()));

drop policy if exists "follows_insert_self" on public.follows;
create policy "follows_insert_self" on public.follows for insert
  with check (
    auth.uid() = follower_id
    and not public.is_blocked_by(following_id, auth.uid())
    and not public.is_blocked_by(auth.uid(), following_id)
  );

-- A blocked 1-on-1 peer can no longer send messages in an existing chat.
drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages for insert with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
  and not exists (
    select 1
    from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id
    where c.id = messages.conversation_id
      and c.is_group = false
      and m.user_id <> auth.uid()
      and (
        public.is_blocked_by(m.user_id, auth.uid())
        or public.is_blocked_by(auth.uid(), m.user_id)
      )
  )
);

-- ============================================================================
-- Notification triggers now respect per-user preferences.
-- ============================================================================
create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.follower_id <> new.following_id
       and public.wants_notification(new.following_id, 'follow') then
      insert into public.notifications (user_id, type, actor_id, reference_id)
      values (new.following_id, 'follow', new.follower_id, null);
    end if;
  elsif tg_op = 'DELETE' then
    delete from public.notifications
     where type = 'follow'
       and user_id = old.following_id
       and actor_id = old.follower_id;
  end if;
  return null;
end;
$$;

create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
begin
  if tg_op = 'INSERT' then
    select user_id into post_author from public.posts where id = new.post_id;
    if post_author is not null and post_author <> new.user_id
       and public.wants_notification(post_author, 'like') then
      insert into public.notifications (user_id, type, actor_id, reference_id)
      values (post_author, 'like', new.user_id, new.post_id);
    end if;
  elsif tg_op = 'DELETE' then
    delete from public.notifications
     where type = 'like'
       and actor_id = old.user_id
       and reference_id = old.post_id;
  end if;
  return null;
end;
$$;

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
       and public.wants_notification(mentioned_id, 'mention') then
      insert into public.notifications (user_id, type, actor_id, reference_id)
      values (mentioned_id, 'mention', new.user_id, new.id);
    end if;
  end loop;
  return null;
end;
$$;

-- ============================================================================
-- create_conversation now enforces blocks + the recipient's DM privacy.
-- ============================================================================
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
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if target_ids is null or array_length(target_ids, 1) is null then
    raise exception 'No recipients';
  end if;

  all_ids := (
    select array_agg(distinct x)
    from unnest(array_append(target_ids, me)) as x
  );

  make_group := coalesce(is_group_in, false) or array_length(all_ids, 1) > 2;

  -- Reopen an existing 1-on-1 first, so block / DM-privacy rules gate only NEW
  -- conversations (ongoing sends in an existing chat are gated by the messages
  -- policy instead). Matches the original 0003 behaviour.
  if not make_group and array_length(all_ids, 1) = 2 then
    select c.id into existing
    from public.conversations c
    where c.is_group = false
      and (select count(*) from public.conversation_participants p where p.conversation_id = c.id) = 2
      and exists (select 1 from public.conversation_participants p where p.conversation_id = c.id and p.user_id = all_ids[1])
      and exists (select 1 from public.conversation_participants p where p.conversation_id = c.id and p.user_id = all_ids[2])
    limit 1;
    if existing is not null then
      return existing;
    end if;
  end if;

  -- Block + DM-privacy checks against each distinct target (new conversations).
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
          select 1 from public.follows where follower_id = t and following_id = me
        ) then
        raise exception 'This user only accepts messages from people they follow.'
          using errcode = 'check_violation';
      end if;
    end if;
  end loop;

  insert into public.conversations (is_group, name, created_by)
  values (
    make_group,
    case when make_group then nullif(trim(coalesce(group_name, '')), '') else null end,
    me
  )
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  select conv_id, x from unnest(all_ids) as x;

  return conv_id;
end;
$$;

notify pgrst, 'reload schema';
