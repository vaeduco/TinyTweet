-- ============================================================================
-- TinyTweet — rich media in messages & replies + unsend
-- Run AFTER 0001–0007, in the Supabase SQL Editor. Safe to re-run.
--
-- Adds attachments (image / gif / audio) to messages and (image / gif) to
-- replies, a per-message soft-delete for "unsend", and a message-media storage
-- bucket. The message UPDATE guard is rewritten so a SENDER can unsend their own
-- message while a RECIPIENT can still only flip status sent -> delivered.
-- ============================================================================

-- ---- messages: attachments + soft-delete -----------------------------------
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_type text;
alter table public.messages add column if not exists duration_seconds integer;
alter table public.messages add column if not exists deleted_at timestamptz;

alter table public.messages drop constraint if exists messages_attachment_type_check;
alter table public.messages add constraint messages_attachment_type_check
  check (attachment_type is null or attachment_type in ('image', 'gif', 'audio'));

alter table public.messages drop constraint if exists messages_duration_check;
alter table public.messages add constraint messages_duration_check
  check (duration_seconds is null or duration_seconds >= 0);

-- Allow attachment-only messages: content may now be empty (was 1..2000).
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check
  check (char_length(content) <= 2000);

-- A message must carry text OR an attachment (or be an unsend placeholder).
alter table public.messages drop constraint if exists messages_content_or_attachment;
alter table public.messages add constraint messages_content_or_attachment
  check (char_length(content) > 0 or attachment_url is not null);

-- ---- replies: attachments --------------------------------------------------
alter table public.replies add column if not exists attachment_url text;
alter table public.replies add column if not exists attachment_type text;

alter table public.replies drop constraint if exists replies_attachment_type_check;
alter table public.replies add constraint replies_attachment_type_check
  check (attachment_type is null or attachment_type in ('image', 'gif'));

alter table public.replies drop constraint if exists replies_content_check;
alter table public.replies add constraint replies_content_check
  check (char_length(content) <= 280);

alter table public.replies drop constraint if exists replies_content_or_attachment;
alter table public.replies add constraint replies_content_or_attachment
  check (char_length(content) > 0 or attachment_url is not null);

-- ---- Rewrite the message UPDATE guard --------------------------------------
-- Two distinct, non-overlapping update paths:
--   A) a RECIPIENT flips status sent -> delivered (nothing else may change);
--   B) the SENDER unsends their own message (sets deleted_at; the server also
--      blanks content + attachment). Identity columns are immutable for both.
create or replace function public.messages_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Cannot change id, sender, conversation, or timestamp of a message';
  end if;

  -- Path B: sender unsends their own message.
  if auth.uid() = old.sender_id then
    if new.status is distinct from old.status then
      raise exception 'You cannot change the status of your own message';
    end if;
    if old.deleted_at is not null then
      raise exception 'Message already unsent';
    end if;
    if new.deleted_at is null then
      raise exception 'A sender may only unsend their own message';
    end if;
    return new;
  end if;

  -- Path A: recipient flips status only.
  if new.content is distinct from old.content
     or new.deleted_at is distinct from old.deleted_at
     or new.attachment_url is distinct from old.attachment_url
     or new.attachment_type is distinct from old.attachment_type
     or new.duration_seconds is distinct from old.duration_seconds then
    raise exception 'Only status may be updated on a message';
  end if;
  if new.status is distinct from old.status
     and not (old.status = 'sent' and new.status = 'delivered') then
    raise exception 'Invalid status transition';
  end if;
  return new;
end;
$$;

-- (messages_update_member policy + messages_guard_update_trigger from 0004 stay.)

-- ---- Storage: message-media bucket (images + audio) ------------------------
-- NOTE (privacy tradeoff): like avatars/post-images (0001), this bucket is
-- public-read, so DM attachment bytes are reachable by anyone who obtains the
-- URL. Uploads use random UUID filenames (lib/upload.ts) so URLs can't be
-- guessed/enumerated, but a leaked URL (referer, logs) is not access-controlled
-- the way the message ROW is. For strict DM-media confidentiality, switch to a
-- private bucket + short-lived signed URLs (createSignedUrl) generated per view.
insert into storage.buckets (id, name, public)
values ('message-media', 'message-media', true)
on conflict (id) do nothing;

drop policy if exists "message_media_read" on storage.objects;
create policy "message_media_read" on storage.objects
  for select using (bucket_id = 'message-media');

drop policy if exists "message_media_insert_own" on storage.objects;
create policy "message_media_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "message_media_update_own" on storage.objects;
create policy "message_media_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'message-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "message_media_delete_own" on storage.objects;
create policy "message_media_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
