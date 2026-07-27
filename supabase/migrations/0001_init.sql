-- ============================================================================
-- TinyTweet — initial schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query),
-- or via the Supabase CLI: `supabase db push`.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP … IF EXISTS.
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists pg_trgm;

-- ============================================================================
-- Tables
-- ============================================================================

-- profiles -------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique
                 check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 50),
  bio          text check (char_length(bio) <= 160),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- posts ----------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  content     text not null
                check (char_length(content) between 1 and 280),
  image_url   text,
  like_count  integer not null default 0,
  reply_count integer not null default 0,
  created_at  timestamptz not null default now()
);

-- replies (threaded) ---------------------------------------------------------
create table if not exists public.replies (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.posts (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  content         text not null
                    check (char_length(content) between 1 and 280),
  parent_reply_id uuid references public.replies (id) on delete cascade,
  created_at      timestamptz not null default now()
);

-- likes ----------------------------------------------------------------------
create table if not exists public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- follows --------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================
create index if not exists posts_created_at_idx        on public.posts (created_at desc);
create index if not exists posts_user_created_idx      on public.posts (user_id, created_at desc);
create index if not exists posts_content_trgm_idx      on public.posts using gin (content gin_trgm_ops);
create index if not exists replies_post_created_idx    on public.replies (post_id, created_at);
create index if not exists replies_parent_idx          on public.replies (parent_reply_id);
create index if not exists replies_user_idx            on public.replies (user_id);
create index if not exists likes_post_idx              on public.likes (post_id);
create index if not exists follows_following_idx       on public.follows (following_id);
create index if not exists follows_follower_idx        on public.follows (follower_id);
create index if not exists profiles_username_trgm_idx  on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_dispname_trgm_idx  on public.profiles using gin (display_name gin_trgm_ops);

-- ============================================================================
-- Functions & triggers
-- ============================================================================

-- Keep profiles.updated_at fresh --------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row automatically on signup ------------------------------
-- SECURITY DEFINER so it can write to profiles regardless of RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 12)
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'username', '')
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Reject reserved / route-colliding usernames at the DB level so the rule holds
-- regardless of insertion path (server action, a direct Auth API signup with the
-- public anon key, or a later username UPDATE). Mirrors lib/validation.ts.
create or replace function public.reject_reserved_username()
returns trigger
language plpgsql
as $$
begin
  if new.username = any (array[
    'login','signup','logout','signout','search','hashtag','post','settings',
    'admin','about','api','auth','explore','home','notifications','messages',
    'help','terms','privacy','tinytweet','support','new','edit','profile',
    'me','user','static','public','assets'
  ]) then
    raise exception 'username "%" is reserved', new.username
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reject_reserved_username on public.profiles;
create trigger profiles_reject_reserved_username
  before insert or update of username on public.profiles
  for each row execute function public.reject_reserved_username();

-- Maintain posts.like_count --------------------------------------------------
create or replace function public.handle_like_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_count_trigger on public.likes;
create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.handle_like_change();

-- Maintain posts.reply_count -------------------------------------------------
create or replace function public.handle_reply_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set reply_count = reply_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set reply_count = greatest(reply_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists replies_count_trigger on public.replies;
create trigger replies_count_trigger
  after insert or delete on public.replies
  for each row execute function public.handle_reply_change();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.replies  enable row level security;
alter table public.likes    enable row level security;
alter table public.follows  enable row level security;

-- profiles: public read, self-write ------------------------------------------
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- posts: public read, owner write --------------------------------------------
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts
  for select using (true);

drop policy if exists "posts_insert_owner" on public.posts;
create policy "posts_insert_owner" on public.posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "posts_update_owner" on public.posts;
create policy "posts_update_owner" on public.posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posts_delete_owner" on public.posts;
create policy "posts_delete_owner" on public.posts
  for delete using (auth.uid() = user_id);

-- replies: public read, owner write ------------------------------------------
drop policy if exists "replies_select_all" on public.replies;
create policy "replies_select_all" on public.replies
  for select using (true);

drop policy if exists "replies_insert_owner" on public.replies;
create policy "replies_insert_owner" on public.replies
  for insert with check (auth.uid() = user_id);

drop policy if exists "replies_update_owner" on public.replies;
create policy "replies_update_owner" on public.replies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "replies_delete_owner" on public.replies;
create policy "replies_delete_owner" on public.replies
  for delete using (auth.uid() = user_id);

-- likes: public read, self-write ---------------------------------------------
drop policy if exists "likes_select_all" on public.likes;
create policy "likes_select_all" on public.likes
  for select using (true);

drop policy if exists "likes_insert_self" on public.likes;
create policy "likes_insert_self" on public.likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "likes_delete_self" on public.likes;
create policy "likes_delete_self" on public.likes
  for delete using (auth.uid() = user_id);

-- follows: public read, self-write -------------------------------------------
drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all" on public.follows
  for select using (true);

drop policy if exists "follows_insert_self" on public.follows;
create policy "follows_insert_self" on public.follows
  for insert with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_self" on public.follows;
create policy "follows_delete_self" on public.follows
  for delete using (auth.uid() = follower_id);

-- ============================================================================
-- Storage buckets & policies
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Public read for both buckets
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select using (bucket_id in ('avatars', 'post-images'));

-- Authenticated users may upload into a folder named after their own uid,
-- e.g. "<uid>/avatar.png". This prevents overwriting other users' files.
drop policy if exists "media_insert_own_folder" on storage.objects;
create policy "media_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_update_own_folder" on storage.objects;
create policy "media_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_delete_own_folder" on storage.objects;
create policy "media_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Realtime — broadcast INSERT/UPDATE/DELETE for the feed
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'replies'
  ) then
    alter publication supabase_realtime add table public.replies;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'likes'
  ) then
    alter publication supabase_realtime add table public.likes;
  end if;
end $$;

-- Include full row data on UPDATE/DELETE realtime payloads.
alter table public.posts   replica identity full;
alter table public.replies replica identity full;
alter table public.likes   replica identity full;
