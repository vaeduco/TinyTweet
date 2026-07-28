-- ============================================================================
-- TinyTweet — presence (last seen)
-- Run AFTER 0001–0005, in the Supabase SQL Editor. Safe to re-run.
--
-- `last_seen_at` lives on profiles. RLS is already exactly what the feature
-- needs: profiles_select_all (0001) makes it readable by anyone, and
-- profiles_update_self (0001) lets only the owner write it — so no new policy
-- is required. "Active now" is tracked separately via Supabase Realtime
-- Presence (client-side), not persisted here.
-- ============================================================================

alter table public.profiles
  add column if not exists last_seen_at timestamptz;
