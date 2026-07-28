-- ============================================================================
-- TinyTweet — message delivery status (sent / delivered)
-- Run AFTER 0001–0003, in the Supabase SQL Editor. Safe to re-run.
--
-- A message is 'sent' on insert. The RECIPIENT's client flips it to 'delivered'
-- (on receiving it live, or on opening the conversation). A guarded UPDATE
-- policy lets a participant change ONLY the status column, ONLY sent->delivered,
-- and never on their own message — so "delivered" can't be forged by the sender.
-- ============================================================================

alter table public.messages
  add column if not exists status text not null default 'sent'
    check (status in ('sent', 'delivered'));

-- Participants may update messages in their conversations (columns/values
-- restricted by the guard trigger below).
drop policy if exists "messages_update_member" on public.messages;
create policy "messages_update_member" on public.messages
  for update using (public.is_conversation_participant(conversation_id))
  with check (public.is_conversation_participant(conversation_id));

create or replace function public.messages_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.content is distinct from old.content
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only status may be updated on a message';
  end if;
  if auth.uid() = old.sender_id then
    raise exception 'You cannot change the status of your own message';
  end if;
  if new.status is distinct from old.status
     and not (old.status = 'sent' and new.status = 'delivered') then
    raise exception 'Invalid status transition';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard_update_trigger on public.messages;
create trigger messages_guard_update_trigger
  before update on public.messages
  for each row execute function public.messages_guard_update();
