-- ============================================================================
-- TinyTweet — pin a post to the top of your profile (one pinned post per user).
-- Safe to re-run.
-- ============================================================================

alter table public.posts
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

-- Enforce at most one pinned post per user. This guards the invariant even
-- against a direct owner UPDATE (posts_update_owner), not just the RPC below.
create unique index if not exists posts_one_pinned_per_user
  on public.posts (user_id) where is_pinned;

-- Atomic, owner-scoped pin toggle. Pinning a post first unpins the user's
-- previous pin (so at no point are two of their posts pinned, keeping the
-- partial unique index happy). SECURITY DEFINER + the auth.uid() ownership
-- check are what enforce "only the post owner can pin/unpin".
create or replace function public.set_pinned_post(p_post_id uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.posts where id = p_post_id and user_id = v_uid
  ) then
    raise exception 'You can only pin your own posts' using errcode = '42501';
  end if;

  if p_pinned then
    update public.posts set is_pinned = false, pinned_at = null
     where user_id = v_uid and is_pinned = true and id <> p_post_id;
    update public.posts set is_pinned = true, pinned_at = now()
     where id = p_post_id;
  else
    update public.posts set is_pinned = false, pinned_at = null
     where id = p_post_id and user_id = v_uid;
  end if;
end;
$$;

notify pgrst, 'reload schema';
