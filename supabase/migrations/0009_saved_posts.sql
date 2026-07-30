-- ============================================================================
-- TinyTweet — saved posts (bookmarks)
-- Run AFTER 0001–0008, in the Supabase SQL Editor. Safe to re-run.
--
-- Mirrors `likes`, but bookmarks are PRIVATE: only the owner can read their own
-- saves (likes are world-readable; a bookmark list should not be).
-- ============================================================================

create table if not exists public.saved_posts (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists saved_posts_user_created_idx
  on public.saved_posts (user_id, created_at desc);

alter table public.saved_posts enable row level security;

drop policy if exists "saved_select_own" on public.saved_posts;
create policy "saved_select_own" on public.saved_posts
  for select using (user_id = auth.uid());

drop policy if exists "saved_insert_self" on public.saved_posts;
create policy "saved_insert_self" on public.saved_posts
  for insert with check (user_id = auth.uid());

drop policy if exists "saved_delete_self" on public.saved_posts;
create policy "saved_delete_self" on public.saved_posts
  for delete using (user_id = auth.uid());
