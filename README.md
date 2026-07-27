# 🐦 TinyTweet

A tiny Twitter-style micro-blogging platform built with **Next.js 15 (App Router)**, **Tailwind CSS + shadcn/ui**, and **Supabase** (Auth, Postgres, Storage, Realtime). Deploy-ready for Vercel.

## Features

- **Email/password auth** via Supabase Auth, with automatic profile creation on signup
- **Profiles** — username, display name, bio, and avatar (Supabase Storage)
- **Compose posts** — up to 280 characters, with an optional image
- **Home feed** — reverse-chronological posts from you and the people you follow, with **realtime** updates
- **Public profile pages** with follow / unfollow
- **Likes** with live counts and **threaded replies** with reply counts
- **#hashtags** and **@mentions** parsed and clickable
- **Search** — people by username/display name, posts by keyword or hashtag
- **Dark mode** toggle, mobile-first responsive card UI, and loading skeletons
- **Row Level Security** on every table — users can only edit/delete their own content

## Tech stack

| Layer     | Choice                                            |
| --------- | ------------------------------------------------- |
| Framework | Next.js 15 (App Router, React 19, Server Actions) |
| Styling   | Tailwind CSS 3, shadcn/ui, next-themes            |
| Backend   | Supabase — Postgres, Auth, Storage, Realtime      |
| Data      | `@supabase/ssr` (cookie-based sessions)           |
| Deploy    | Vercel                                            |

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project values (Dashboard → **Project Settings → API**):

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Optional, server-only, not used by the app itself:
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> The **anon key** is safe to expose to the browser (it is protected by Row Level Security). Never expose the **service role key** — keep it out of client code and out of git (`.env.local` is git-ignored).

### 3. Set up the database

Open the Supabase Dashboard → **SQL Editor** → **New query**, paste the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it.

This creates all tables (`profiles`, `posts`, `replies`, `likes`, `follows`), indexes, triggers (auto profile on signup, like/reply counters), **Row Level Security policies**, the `avatars` and `post-images` **Storage buckets** with policies, and enables **Realtime** on the feed tables. The script is safe to re-run.

_(If you use the Supabase CLI instead: `supabase db push`.)_

### 4. Configure Auth

In the Dashboard → **Authentication**:

- **URL Configuration** → set **Site URL** to `http://localhost:3000` for local dev (and your Vercel URL in production). Add both to **Redirect URLs**.
- **Providers → Email**: for the fastest start, turn **"Confirm email" OFF** so new signups are logged in immediately.
- If you keep email confirmation **ON**, point the **"Confirm signup"** email template at the built-in handler:
  ```
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
  ```
  (route implemented at [`app/auth/confirm/route.ts`](app/auth/confirm/route.ts)).

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start posting.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel → it auto-detects Next.js.
3. Add the environment variables from your `.env.local` (at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in **Project Settings → Environment Variables**.
4. Deploy. Then add your production domain to the Supabase **Site URL / Redirect URLs**.

---

## Project structure

```
app/
  (auth)/            login & signup (centered layout)
  (main)/            navbar layout — feed, profiles, thread, search, hashtag
    page.tsx         home feed
    [username]/      public profile
    post/[id]/       post detail + threaded replies
    search/          people & posts search
    hashtag/[tag]/   posts for a hashtag
  actions/           server actions (posts, likes, follows, replies, profile)
  auth/              auth server actions + email-confirm route
components/          feed, post-card, compose-box, navbar, profile, replies, ui/*
lib/
  supabase/          browser + server + middleware clients
  queries.ts         server-side data helpers
  parse.tsx          #hashtag / @mention / URL linkifier (XSS-safe)
  types.ts           hand-written DB types
supabase/migrations/ SQL schema + RLS + storage + realtime
middleware.ts        refreshes the Supabase session on each request
```

## Notes

- **Security:** post/reply content is rendered as React nodes (never `dangerouslySetInnerHTML`), so hashtag/mention linkification is XSS-safe. Every table enforces RLS; writes are scoped to `auth.uid()`.
- **Realtime:** the home feed subscribes to `INSERT`/`DELETE` on `posts` for authors you follow (and yourself).
- **Images** use plain `<img>` (Supabase public URLs), so no image CDN configuration is required.
