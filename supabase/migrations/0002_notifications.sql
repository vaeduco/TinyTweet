-- ============================================================================
-- TinyTweet — notifications
-- Run AFTER 0001_init.sql, in the Supabase SQL Editor (or `supabase db push`).
-- Safe to re-run.
--
-- Notifications are created ONLY by SECURITY DEFINER triggers below (on new
-- follow / like / reply / @mention). Row Level Security lets each user read and
-- update only their own notifications, and grants NO insert policy — so clients
-- can never fabricate notifications; only the definer triggers can write them.
-- ============================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade, -- recipient
  type         text not null check (type in ('follow', 'like', 'reply', 'mention')),
  actor_id     uuid not null references public.profiles (id) on delete cascade, -- who triggered it
  reference_id uuid references public.posts (id) on delete cascade,             -- related post (null for follow)
  reply_id     uuid references public.replies (id) on delete cascade,           -- originating reply (reply / mention-in-reply); cascades on reply delete
  is_read      boolean not null default false,
  created_at   timestamptz not null default now(),
  check (user_id <> actor_id) -- never notify yourself
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where is_read = false;

-- Idempotent add for installs created before reply_id existed.
alter table public.notifications
  add column if not exists reply_id uuid references public.replies (id) on delete cascade;

-- ============================================================================
-- Trigger functions (SECURITY DEFINER so they bypass RLS to write rows)
-- ============================================================================

-- New follower ---------------------------------------------------------------
create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.follower_id <> new.following_id then
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

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert or delete on public.follows
  for each row execute function public.notify_follow();

-- Like on your post ----------------------------------------------------------
create or replace function public.notify_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
begin
  if tg_op = 'INSERT' then
    select user_id into post_author from public.posts where id = new.post_id;
    if post_author is not null and post_author <> new.user_id then
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

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify
  after insert or delete on public.likes
  for each row execute function public.notify_like();

-- Reply to your post (+ @mentions inside the reply) --------------------------
create or replace function public.notify_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  mentioned_username text;
  mentioned_id uuid;
begin
  select user_id into post_author from public.posts where id = new.post_id;

  -- Notify the post author of the reply.
  if post_author is not null and post_author <> new.user_id then
    insert into public.notifications (user_id, type, actor_id, reference_id, reply_id)
    values (post_author, 'reply', new.user_id, new.post_id, new.id);
  end if;

  -- Notify @mentioned users (skip the author and the already-notified post author).
  for mentioned_username in
    select distinct lower(t.arr[1])
    from regexp_matches(new.content, '@([A-Za-z0-9_]+)', 'g') as t(arr)
  loop
    select id into mentioned_id from public.profiles where username = mentioned_username;
    if mentioned_id is not null
       and mentioned_id <> new.user_id
       and (post_author is null or mentioned_id <> post_author) then
      insert into public.notifications (user_id, type, actor_id, reference_id, reply_id)
      values (mentioned_id, 'mention', new.user_id, new.post_id, new.id);
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists replies_notify on public.replies;
create trigger replies_notify
  after insert on public.replies
  for each row execute function public.notify_reply();

-- @mentions inside a new post ------------------------------------------------
create or replace function public.notify_post_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mentioned_username text;
  mentioned_id uuid;
begin
  for mentioned_username in
    select distinct lower(t.arr[1])
    from regexp_matches(new.content, '@([A-Za-z0-9_]+)', 'g') as t(arr)
  loop
    select id into mentioned_id from public.profiles where username = mentioned_username;
    if mentioned_id is not null and mentioned_id <> new.user_id then
      insert into public.notifications (user_id, type, actor_id, reference_id)
      values (mentioned_id, 'mention', new.user_id, new.id);
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists posts_notify_mention on public.posts;
create trigger posts_notify_mention
  after insert on public.posts
  for each row execute function public.notify_post_mention();

-- ============================================================================
-- Row Level Security — read/update/delete own only; NO insert policy
-- ============================================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);

-- Only `is_read` may change on an existing notification (the update policy
-- above gates the row; this gates the columns so a user can't rewrite the
-- type/actor/reference of their own notifications).
create or replace function public.notifications_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.type is distinct from old.type
     or new.actor_id is distinct from old.actor_id
     or new.reference_id is distinct from old.reference_id
     or new.reply_id is distinct from old.reply_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only is_read may be updated on a notification';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_update_trigger on public.notifications;
create trigger notifications_guard_update_trigger
  before update on public.notifications
  for each row execute function public.notifications_guard_update();

-- ============================================================================
-- Realtime — push new notifications to the recipient live
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

alter table public.notifications replica identity full;
