-- ============================================================================
-- TinyTweet — polls
-- Adds polls attached to posts: 2–4 options, a closing time, one vote per user.
-- Individual votes are PRIVATE (own-row select); aggregate counts are public via
-- a denormalized poll_options.vote_count maintained by a trigger (mirrors the
-- posts.like_count pattern). Safe to re-run.
-- ============================================================================

-- Tables ---------------------------------------------------------------------

-- One poll per post.
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null unique references public.posts (id) on delete cascade,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now()
);

-- 2–4 options per poll, kept in a stable display order via `position`.
create table if not exists public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 25),
  position   smallint not null check (position between 0 and 3),
  vote_count integer not null default 0,
  unique (poll_id, position)
);

-- One vote per (poll, user). Votes are final — no update/delete path.
create table if not exists public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists poll_options_poll_idx on public.poll_options (poll_id);
create index if not exists poll_votes_option_idx  on public.poll_votes (option_id);

-- Vote-count trigger ---------------------------------------------------------
-- Validates the vote and bumps the chosen option's counter. SECURITY DEFINER so
-- it can update poll_options (which has no public UPDATE policy).
create or replace function public.handle_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_option_poll uuid;
  v_ends_at     timestamptz;
begin
  -- The chosen option must belong to the poll being voted on.
  select poll_id into v_option_poll from public.poll_options where id = new.option_id;
  if v_option_poll is null or v_option_poll <> new.poll_id then
    raise exception 'Option does not belong to this poll' using errcode = 'check_violation';
  end if;

  -- The poll must still be open.
  select ends_at into v_ends_at from public.polls where id = new.poll_id;
  if v_ends_at is null or v_ends_at <= now() then
    raise exception 'This poll has already closed' using errcode = 'check_violation';
  end if;

  update public.poll_options set vote_count = vote_count + 1 where id = new.option_id;
  return new;
end;
$$;

drop trigger if exists poll_votes_after_insert on public.poll_votes;
create trigger poll_votes_after_insert
  after insert on public.poll_votes
  for each row execute function public.handle_poll_vote();

-- Atomic post+poll creation --------------------------------------------------
-- Creates the post, its poll, and 2–4 options in one transaction so a partially
-- built poll can never be left behind. Runs as definer but authorizes via
-- auth.uid() and relies on the posts CHECK for content length.
create or replace function public.create_poll_post(
  p_content          text,
  p_options          text[],
  p_duration_minutes integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_post_id uuid;
  v_poll_id uuid;
  v_n       int  := array_length(p_options, 1);
  v_opt     text;
  i         int;
begin
  if v_uid is null then
    raise exception 'You must be signed in to post.' using errcode = '28000';
  end if;
  if p_content is null or char_length(btrim(p_content)) = 0 then
    raise exception 'Your post can''t be empty.' using errcode = 'check_violation';
  end if;
  if v_n is null or v_n < 2 or v_n > 4 then
    raise exception 'A poll needs between 2 and 4 options.' using errcode = 'check_violation';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 5 or p_duration_minutes > 10080 then
    raise exception 'Poll length must be between 5 minutes and 7 days.' using errcode = 'check_violation';
  end if;

  insert into public.posts (user_id, content)
  values (v_uid, btrim(p_content))
  returning id into v_post_id;

  insert into public.polls (post_id, ends_at)
  values (v_post_id, now() + make_interval(mins => p_duration_minutes))
  returning id into v_poll_id;

  for i in 1 .. v_n loop
    v_opt := btrim(p_options[i]);
    if char_length(v_opt) = 0 then
      raise exception 'Poll options can''t be empty.' using errcode = 'check_violation';
    end if;
    insert into public.poll_options (poll_id, text, position)
    values (v_poll_id, left(v_opt, 25), i - 1);
  end loop;

  return v_post_id;
end;
$$;

-- Row Level Security ---------------------------------------------------------
alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

-- polls & options: world-readable (like posts).
drop policy if exists "polls_select_all" on public.polls;
create policy "polls_select_all" on public.polls for select using (true);

drop policy if exists "poll_options_select_all" on public.poll_options;
create policy "poll_options_select_all" on public.poll_options for select using (true);

-- Polls and their options are created ONLY through the create_poll_post RPC
-- (SECURITY DEFINER, which runs as the table owner and so bypasses RLS). It is
-- the single validated entry point: it enforces ownership, the 2–4 option count,
-- the duration bounds, and a zero starting vote_count. There is deliberately NO
-- direct-insert policy on these tables, so RLS denies any client INSERT — that
-- prevents a poll owner from seeding a fake vote_count or a malformed poll
-- straight through PostgREST. (Drop any insert policies left by an earlier run.)
drop policy if exists "polls_insert_own_post" on public.polls;
drop policy if exists "poll_options_insert_own" on public.poll_options;

-- poll_votes: a voter may cast and read only their own vote. Aggregate counts
-- are exposed through poll_options.vote_count, so individual votes stay private.
drop policy if exists "poll_votes_insert_self" on public.poll_votes;
create policy "poll_votes_insert_self" on public.poll_votes for insert
  with check (auth.uid() = user_id);

drop policy if exists "poll_votes_select_own" on public.poll_votes;
create policy "poll_votes_select_own" on public.poll_votes for select
  using (auth.uid() = user_id);
