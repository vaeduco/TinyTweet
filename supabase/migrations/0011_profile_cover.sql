-- ============================================================================
-- TinyTweet — profile cover photos
-- Adds a nullable cover_url to profiles. Cover images reuse the existing public
-- `avatars` bucket (its own-folder RLS already permits `<uid>/cover-*.<ext>`),
-- so no new bucket or storage policy is needed. Safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists cover_url text;
