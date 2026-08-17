# Web Push setup

In-app alerts (toasts + sound) work with no setup. **Browser push** needs the
one-time setup below — until then the app degrades gracefully (the Settings
"Push notifications" toggle shows "Not set up on the server yet" and nothing
errors).

## 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Keep the **public** and **private** keys handy.

## 2. Client env var (public key)

Add the public key to `.env.local` **and** to the Vercel project's Environment
Variables, then redeploy:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
```

## 3. Run the migration

Run `supabase/migrations/0019_push_notifications.sql` in the Supabase SQL editor
(creates `push_subscriptions` + `profiles.notify_sound`).

## 4. Deploy the Edge Function + its secrets

```bash
supabase functions deploy push-notify --no-verify-jwt

supabase secrets set \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:you@example.com \
  WEBHOOK_SECRET=<a long random string>
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

The function's URL is `https://<project-ref>.supabase.co/functions/v1/push-notify`.

## 5. Create the Database Webhooks

In the Supabase dashboard → **Database → Webhooks**, create **two** webhooks
(HTTP POST to the function URL, each adding header
`x-webhook-secret: <WEBHOOK_SECRET>`):

| Name | Table | Events |
|------|-------|--------|
| push-on-notification | `public.notifications` | Insert |
| push-on-message | `public.messages` | Insert |

## 6. Try it

1. Open the deployed app, go to **Settings → Notifications**, flip **Push
   notifications** on, and allow the browser prompt. (Or wait for the deferred
   in-app nudge after a few visits.)
2. From another account, like/reply to/follow you, or send you a message.
3. You get an OS notification even with the tab closed; clicking it opens the
   relevant post/conversation.

## Notes

- Push respects the same preferences as in-app: notification pushes only fire
  for types you've enabled (the notification row already honored the pref), and
  message pushes skip muted conversations.
- Expired subscriptions (HTTP 404/410) are pruned automatically.
- `notificationText()` in `lib/notification-text.ts` and its mirror in the Edge
  Function must stay in sync if you change the wording.
