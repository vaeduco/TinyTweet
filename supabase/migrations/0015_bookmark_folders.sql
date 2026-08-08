-- ============================================================================
-- TinyTweet — bookmark folders. Organise saved posts into user-owned folders;
-- a null folder_id means "uncategorized". Everything is private to the owner.
-- Safe to re-run.
-- ============================================================================

create table if not exists public.bookmark_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 50),
  created_at timestamptz not null default now()
);

create index if not exists bookmark_folders_user_idx
  on public.bookmark_folders (user_id, created_at);

-- Deleting a folder moves its posts back to uncategorized (SET NULL) rather
-- than removing the saved posts themselves.
alter table public.saved_posts
  add column if not exists folder_id uuid
    references public.bookmark_folders (id) on delete set null;

create index if not exists saved_posts_folder_idx
  on public.saved_posts (user_id, folder_id);

-- Folders are private: owner-only for every operation.
alter table public.bookmark_folders enable row level security;

drop policy if exists "bookmark_folders_select_own" on public.bookmark_folders;
create policy "bookmark_folders_select_own" on public.bookmark_folders
  for select using (user_id = auth.uid());

drop policy if exists "bookmark_folders_insert_own" on public.bookmark_folders;
create policy "bookmark_folders_insert_own" on public.bookmark_folders
  for insert with check (user_id = auth.uid());

drop policy if exists "bookmark_folders_update_own" on public.bookmark_folders;
create policy "bookmark_folders_update_own" on public.bookmark_folders
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "bookmark_folders_delete_own" on public.bookmark_folders;
create policy "bookmark_folders_delete_own" on public.bookmark_folders
  for delete using (user_id = auth.uid());

-- saved_posts already has own-only select/insert/delete (0009). Re-scope INSERT
-- and add UPDATE so a bookmark can be filed into / moved between folders, with a
-- WITH CHECK on folder ownership so a save can't be put in someone else's folder.
drop policy if exists "saved_insert_self" on public.saved_posts;
create policy "saved_insert_self" on public.saved_posts
  for insert with check (
    user_id = auth.uid()
    and (
      folder_id is null
      or exists (
        select 1 from public.bookmark_folders f
        where f.id = folder_id and f.user_id = auth.uid()
      )
    )
  );

drop policy if exists "saved_update_own" on public.saved_posts;
create policy "saved_update_own" on public.saved_posts
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      folder_id is null
      or exists (
        select 1 from public.bookmark_folders f
        where f.id = folder_id and f.user_id = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';
