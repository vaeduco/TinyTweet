-- ============================================================================
-- TinyTweet — conversation privacy hardening
-- Run AFTER 0001–0006, in the Supabase SQL Editor. Safe to re-run.
--
-- Problem: the per-user flags added in 0005 (is_muted, is_archived, deleted_at,
-- is_pinned, pinned_at) and last_read_at (a read receipt) live on
-- conversation_participants, whose SELECT policy let ANY member read EVERY
-- member's row. A row policy cannot hide columns, so a co-participant could read
-- your mute/archive/delete state and when you last read the chat.
--
-- Fix: restrict participant-row SELECT to the owner's own row, and expose the
-- member LIST (needed for names/avatars) through a view that returns only the
-- non-sensitive identity columns, scoped to the caller's conversations.
--
-- Ride-alongs: enforce the pin cap in the database, and restrict the
-- "leave" delete to group conversations (direct chats use soft-delete).
-- ============================================================================

-- ---- 1) PRIVACY: participant rows are readable only by their owner ----------
drop policy if exists "participants_select_member" on public.conversation_participants;
drop policy if exists "participants_select_own" on public.conversation_participants;
create policy "participants_select_own" on public.conversation_participants
  for select using (user_id = auth.uid());

-- ---- 2) Member list via a definer view (non-sensitive columns only) ---------
-- security_invoker = false → the view runs with its owner's rights and so
-- bypasses the own-row policy above; is_conversation_participant() (SECURITY
-- DEFINER, reads auth.uid()) keeps every row scoped to conversations the caller
-- actually belongs to. Only conversation_id / user_id / joined_at are exposed —
-- never the per-user flags.
create or replace view public.conversation_members
with (security_invoker = false) as
  select conversation_id, user_id, joined_at
  from public.conversation_participants
  where public.is_conversation_participant(conversation_id);

grant select on public.conversation_members to authenticated;

-- ---- 3) Enforce the pin cap (max 3) in the database -------------------------
-- Fires only when a row transitions to pinned, so it never blocks unpinning,
-- read-state changes, or handle_new_message's undelete (which leaves is_pinned
-- untouched). Defense-in-depth behind the action-level check.
create or replace function public.enforce_pin_cap()
returns trigger
language plpgsql
as $$
begin
  if new.is_pinned and not old.is_pinned then
    if (
      select count(*) from public.conversation_participants
      where user_id = new.user_id
        and is_pinned
        and deleted_at is null
        and conversation_id <> new.conversation_id
    ) >= 3 then
      raise exception 'You can pin up to 3 conversations.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists participants_enforce_pin_cap on public.conversation_participants;
create trigger participants_enforce_pin_cap
  before update on public.conversation_participants
  for each row execute function public.enforce_pin_cap();

-- ---- 4) "Leave" (hard delete of own row) is for groups only -----------------
-- Direct chats are removed for yourself via soft-delete (deleted_at); you never
-- drop out of a 1-on-1. Scoped to the caller's own conversations so it is not a
-- standalone is_group oracle.
create or replace function public.is_group_conversation(conv uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_conversation_participant(conv)
     and coalesce((select is_group from public.conversations where id = conv), false);
$$;

grant execute on function public.is_group_conversation(uuid) to authenticated;

drop policy if exists "participants_delete_own" on public.conversation_participants;
create policy "participants_delete_own" on public.conversation_participants
  for delete using (
    user_id = auth.uid() and public.is_group_conversation(conversation_id)
  );

-- Make the new view immediately visible to PostgREST.
notify pgrst, 'reload schema';
