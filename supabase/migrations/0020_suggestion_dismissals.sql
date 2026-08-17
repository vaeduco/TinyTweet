-- ============================================================================
-- TinyTweet — dismissed "Who to follow" suggestions.
--
-- One row per (user, dismissed account): when a viewer taps the "x" on a
-- suggested account, we record it here so getWhoToFollow never surfaces that
-- account again. Own-only: a viewer can only ever see/insert/delete their own
-- dismissals.
-- ============================================================================

create table if not exists public.dismissed_suggestions (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  dismissed_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, dismissed_id),
  check (user_id <> dismissed_id)
);

create index if not exists dismissed_suggestions_user_idx
  on public.dismissed_suggestions (user_id);

alter table public.dismissed_suggestions enable row level security;

drop policy if exists "dismissed_suggestions_select_own" on public.dismissed_suggestions;
create policy "dismissed_suggestions_select_own" on public.dismissed_suggestions
  for select using (user_id = auth.uid());

drop policy if exists "dismissed_suggestions_insert_self" on public.dismissed_suggestions;
create policy "dismissed_suggestions_insert_self" on public.dismissed_suggestions
  for insert with check (user_id = auth.uid());

drop policy if exists "dismissed_suggestions_delete_own" on public.dismissed_suggestions;
create policy "dismissed_suggestions_delete_own" on public.dismissed_suggestions
  for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';
