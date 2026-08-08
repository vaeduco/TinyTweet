-- ============================================================================
-- TinyTweet — rename bookmark "folders" → "categories" (table + column),
-- preserving existing data. Idempotent: only renames if the old names remain.
-- (On a fresh project this runs after 0015 and simply renames what it created.)
-- ============================================================================

do $$
begin
  if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'bookmark_folders'
      )
     and not exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'bookmark_categories'
      ) then
    alter table public.bookmark_folders rename to bookmark_categories;
  end if;

  if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'saved_posts'
          and column_name = 'folder_id'
      ) then
    alter table public.saved_posts rename column folder_id to category_id;
  end if;
end $$;

alter index if exists public.bookmark_folders_user_idx
  rename to bookmark_categories_user_idx;
alter index if exists public.saved_posts_folder_idx
  rename to saved_posts_category_idx;

-- Recreate RLS with category-named policies (own-only), dropping the old
-- folder-named ones. Renaming the table carried the policies over under their
-- old names; renaming the column auto-updated their column references.
alter table public.bookmark_categories enable row level security;

drop policy if exists "bookmark_folders_select_own" on public.bookmark_categories;
drop policy if exists "bookmark_categories_select_own" on public.bookmark_categories;
create policy "bookmark_categories_select_own" on public.bookmark_categories
  for select using (user_id = auth.uid());

drop policy if exists "bookmark_folders_insert_own" on public.bookmark_categories;
drop policy if exists "bookmark_categories_insert_own" on public.bookmark_categories;
create policy "bookmark_categories_insert_own" on public.bookmark_categories
  for insert with check (user_id = auth.uid());

drop policy if exists "bookmark_folders_update_own" on public.bookmark_categories;
drop policy if exists "bookmark_categories_update_own" on public.bookmark_categories;
create policy "bookmark_categories_update_own" on public.bookmark_categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "bookmark_folders_delete_own" on public.bookmark_categories;
drop policy if exists "bookmark_categories_delete_own" on public.bookmark_categories;
create policy "bookmark_categories_delete_own" on public.bookmark_categories
  for delete using (user_id = auth.uid());

-- saved_posts insert/update, re-scoped to the renamed column + category owner.
drop policy if exists "saved_insert_self" on public.saved_posts;
create policy "saved_insert_self" on public.saved_posts
  for insert with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from public.bookmark_categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );

drop policy if exists "saved_update_own" on public.saved_posts;
create policy "saved_update_own" on public.saved_posts
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from public.bookmark_categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';
