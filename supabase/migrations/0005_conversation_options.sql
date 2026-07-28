-- ============================================================================
-- TinyTweet — per-user conversation options (archive / delete / mute / pin)
-- Run AFTER 0001–0004, in the Supabase SQL Editor. Safe to re-run.
--
-- All flags live on the caller's OWN conversation_participants row, so one
-- user's archive/delete/mute/pin never affects the other participants. RLS
-- already limits updates/deletes to the owner (participants_update_own from
-- 0003 + participants_delete_own below); the existing guard trigger still
-- blocks re-pointing a row to another conversation.
-- ============================================================================

alter table public.conversation_participants
  add column if not exists is_archived boolean not null default false;
alter table public.conversation_participants
  add column if not exists deleted_at timestamptz;
alter table public.conversation_participants
  add column if not exists is_muted boolean not null default false;
alter table public.conversation_participants
  add column if not exists is_pinned boolean not null default false;
alter table public.conversation_participants
  add column if not exists pinned_at timestamptz;

-- Leaving a group = deleting your own participant row.
drop policy if exists "participants_delete_own" on public.conversation_participants;
create policy "participants_delete_own" on public.conversation_participants
  for delete using (user_id = auth.uid());

-- Clarify the guard message now that several columns are user-updatable (only
-- conversation_id / user_id / joined_at remain immutable — the anti-join-hijack rule).
create or replace function public.participants_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.conversation_id is distinct from old.conversation_id
     or new.user_id is distinct from old.user_id
     or new.joined_at is distinct from old.joined_at then
    raise exception 'Cannot change conversation_id, user_id, or joined_at on a participant row';
  end if;
  return new;
end;
$$;

-- A new message "undeletes" the conversation for everyone who had soft-deleted
-- it, so it reappears in their inbox (standard messaging behaviour).
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

  update public.conversation_participants
     set deleted_at = null
   where conversation_id = new.conversation_id
     and deleted_at is not null;

  return null;
end;
$$;
