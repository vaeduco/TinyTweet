-- ============================================================================
-- TinyTweet — Web Push subscriptions + a sound-cue preference.
--
-- push_subscriptions stores one row per browser/device that opted into Web
-- Push (the PushManager endpoint + its p256dh/auth keys). A Supabase Database
-- Webhook on notifications/messages INSERT invokes the push-notify Edge
-- Function, which reads these rows (service role) and sends the push.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- Private: a subscription is only ever visible/writable by its owner. The Edge
-- Function reads them with the service role, which bypasses RLS.
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "push_subscriptions_insert_self" on public.push_subscriptions;
create policy "push_subscriptions_insert_self" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- Play a subtle sound when a new notification/message arrives in-app. Default
-- on; users can turn it off in Settings → Notifications.
alter table public.profiles
  add column if not exists notify_sound boolean not null default true;

notify pgrst, 'reload schema';
