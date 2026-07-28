-- ============================================================================
-- TinyTweet — messaging (1-on-1 + group chats)
-- Run AFTER 0001 and 0002, in the Supabase SQL Editor. Safe to re-run.
--
-- RLS: users can only read/write within conversations they belong to. To avoid
-- the classic infinite-recursion between the messages/participants policies, all
-- membership checks go through the SECURITY DEFINER helper is_conversation_participant()
-- (runs as owner → bypasses RLS → no recursion). Conversation creation and adding
-- participants happen through SECURITY DEFINER RPCs so clients never insert
-- participant rows directly (which would otherwise let a user join any chat).
-- ============================================================================

-- ---- Tables ----------------------------------------------------------------
create table if not exists public.conversations (
  id                     uuid primary key default gen_random_uuid(),
  is_group               boolean not null default false,
  name                   text check (name is null or char_length(name) between 1 and 60),
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  last_message_at        timestamptz not null default now(),
  last_message_preview   text,
  last_message_sender_id uuid references public.profiles (id) on delete set null
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 2000),
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists participants_user_idx
  on public.conversation_participants (user_id);
create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc);

-- ---- Membership helper (recursion-safe) ------------------------------------
-- Single-argument so a caller can only ever ask about themselves (auth.uid()).
-- Exposing a (conv, uid) form as an RPC would be a public membership oracle.
create or replace function public.is_conversation_participant(conv uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

-- ---- Keep conversations.last_message_* fresh -------------------------------
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.content, 140),
         last_message_sender_id = new.sender_id
   where id = new.conversation_id;
  return null;
end;
$$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- ---- Only last_read_at may change on a participant row (prevents a user from
--      re-pointing their row at another conversation to join it) -------------
create or replace function public.participants_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.conversation_id is distinct from old.conversation_id
     or new.user_id is distinct from old.user_id
     or new.joined_at is distinct from old.joined_at then
    raise exception 'Only last_read_at may be updated on a participant row';
  end if;
  return new;
end;
$$;

drop trigger if exists participants_guard_update_trigger on public.conversation_participants;
create trigger participants_guard_update_trigger
  before update on public.conversation_participants
  for each row execute function public.participants_guard_update();

-- ---- RPC: create (or reuse) a conversation ---------------------------------
-- SECURITY DEFINER so it can insert participant rows regardless of RLS.
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
  me       uuid := auth.uid();
  all_ids  uuid[];
  conv_id  uuid;
  existing uuid;
  make_group boolean;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if target_ids is null or array_length(target_ids, 1) is null then
    raise exception 'No recipients';
  end if;

  -- Full, de-duplicated participant set (targets + me).
  all_ids := (
    select array_agg(distinct x)
    from unnest(array_append(target_ids, me)) as x
  );

  make_group := coalesce(is_group_in, false) or array_length(all_ids, 1) > 2;

  -- 1-on-1 de-dupe: reuse an existing direct conversation between exactly these two.
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

-- ---- RPC: add participants to a conversation you belong to ------------------
create or replace function public.add_participants(conv uuid, add_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_conversation_participant(conv) then
    raise exception 'Not a participant of this conversation';
  end if;
  -- Only groups can gain members; converting a direct chat would expose its
  -- private history to the added person.
  if not (select is_group from public.conversations where id = conv) then
    raise exception 'Cannot add people to a direct conversation';
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  select conv, x from unnest(add_ids) as x
  on conflict (conversation_id, user_id) do nothing;

  update public.conversations c
     set is_group = true
   where c.id = conv
     and (select count(*) from public.conversation_participants p where p.conversation_id = conv) > 2;
end;
$$;

-- ---- Row Level Security ----------------------------------------------------
alter table public.conversations              enable row level security;
alter table public.conversation_participants  enable row level security;
alter table public.messages                   enable row level security;

-- conversations: participants can read (creation/updates happen via definer code)
drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member" on public.conversations
  for select using (public.is_conversation_participant(id));

-- participants: members can see all participant rows of their conversations
drop policy if exists "participants_select_member" on public.conversation_participants;
create policy "participants_select_member" on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id));

-- participants: a user may update only their own row (last_read_at; guarded above)
drop policy if exists "participants_update_own" on public.conversation_participants;
create policy "participants_update_own" on public.conversation_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages: read within your conversations
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages
  for select using (public.is_conversation_participant(conversation_id));

-- messages: send as yourself, only into conversations you belong to
drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

-- ---- Grants ----------------------------------------------------------------
grant execute on function public.is_conversation_participant(uuid) to anon, authenticated;
grant execute on function public.create_conversation(uuid[], boolean, text) to authenticated;
grant execute on function public.add_participants(uuid, uuid[]) to authenticated;

-- Remove the earlier two-argument membership oracle if a prior run created it
-- (policies above now use the single-argument, self-scoped version).
drop function if exists public.is_conversation_participant(uuid, uuid);

-- ---- Realtime --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

alter table public.messages replica identity full;
alter table public.conversations replica identity full;
