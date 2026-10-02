# Savvo Setup Guide

How to run Savvo locally and configure the services it depends on. For a product overview see [README.md](README.md).

## 1. Install and run

```bash
npm install
cp .env.local.example .env.local
PORT=3001 npm run dev
```

Open http://localhost:3001. Set `NEXT_PUBLIC_APP_URL=http://localhost:3001` in `.env.local` so OAuth and email links point at the right port.

## 2. Environment variables

`.env.local.example` lists every variable. In production, `src/lib/env.ts` checks the core set at boot and logs one clear error (plus a Sentry alert) if any are missing. Feature-scoped variables are checked where they are used, and the feature degrades gracefully when they are unset.

**Required in production**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Database and auth |
| `OPENAI_API_KEY` | Extraction, embeddings, drafts, meeting analysis |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Web billing |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting. Without them a production build fails closed (APIs return 429); `next dev` works without them |
| `NEXT_PUBLIC_APP_URL` | Redirect URLs and links in emails |
| `CRON_SECRET` | Authenticates Vercel cron calls; fallback for `INTERNAL_API_SECRET` |

**Feature-scoped**

| Variable | Feature |
|---|---|
| `STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_YEARLY_PRICE_ID` | Pro prices. `STRIPE_LAUNCH_PRICE_ID` / `STRIPE_LAUNCH_YEARLY_PRICE_ID` override them while a launch price runs |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Calendar sync and Google Contacts import |
| `OAUTH_STATE_SECRET` | HMAC for Google OAuth state. Required for Calendar and Contacts connect (no fallback) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Welcome, digest, and nudge emails |
| `RESEND_RECEIVING_DOMAIN`, `RESEND_WEBHOOK_SECRET` | Forwarded-email capture into the after-call inbox |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile on login, signup, and reset. **Required whenever CAPTCHA is enabled in Supabase Auth**, otherwise every email login fails with `captcha_failed` |
| `GOOGLE_AI_API_KEY` | Optional fallback provider for contact extraction |
| `OPENAI_ACTION_MODEL`, `OPENAI_RESEARCH_MODEL` | Optional model overrides (defaults are pinned in code) |
| `INTERNAL_API_SECRET` | Auth callback → welcome-email route (falls back to `CRON_SECRET`) |
| `DEV_SECRET`, `ALLOW_DEV_ENDPOINTS` | `/api/dev/*` helpers. They return 404 in production unless `ALLOW_DEV_ENDPOINTS` is set |
| `ADMIN_EMAILS` | Comma-separated admin accounts |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Error monitoring and source maps |
| `NEXT_PUBLIC_REVENUECAT_IOS_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_ATTRIBUTE_SECRET` | iOS in-app purchase. Pro grants fail closed in production without `REVENUECAT_ATTRIBUTE_SECRET` |
| `CAPACITOR_SERVER_URL` | Point the iOS shell at a non-production URL |
| `APPLE_TEAM_ID`, `APPLE_SIWA_KEY_ID`, `APPLE_SIWA_PRIVATE_KEY`, `APPLE_SERVICES_ID` | Sign in with Apple token revocation on account deletion (App Review 5.1.1(v)). Sign-in works without them; revocation is skipped and logged |
| `APNS_KEY_ID`, `APNS_PRIVATE_KEY` (+ `APPLE_TEAM_ID`), optional `APNS_ENV`, `APNS_BUNDLE_ID` | iOS push notifications. Without them (and without `FCM_SERVICE_ACCOUNT`) the push cron does nothing |
| `FCM_SERVICE_ACCOUNT` | Android push notifications (Firebase service account JSON on one line) |
| `E2E_PASSWORD` | Password for the seeded E2E personas (local only) |

## 3. Supabase

1. Create a project and copy the URL, anon key, and service-role key (Settings → API).
2. Run `supabase-schema.sql` in the SQL Editor (it enables `pgvector`).
3. Apply `supabase/migrations/` in this order. The unprefixed legacy files depend on each other, so alphabetical order fails (`contact_scheduling.sql` needs `archived_at` from `soft_delete_and_embedding_status.sql`):
   1. `events`, `tags`, `contact_activities`, `activity_source`, `integrations`, `search_usage`, `user_preferences`, `teams`, `indexes`
   2. `soft_delete_and_embedding_status` (also raises the free contact limit from the base schema's 25 to 50)
   3. `contact_scheduling`, `duplicate_management`, `unique_active_email`
   4. Every timestamped file (`YYYYMMDDHHMMSS_*.sql`) in timestamp order

   Read [supabase/README.md](supabase/README.md) before writing a new migration: migrations are forward-only and applied manually in the SQL Editor.
4. Authentication:
   - Add `http://localhost:3001` and your production domain to Site URL / Redirect URLs.
   - Google provider: create OAuth credentials in Google Cloud and add `https://<project>.supabase.co/auth/v1/callback` as a redirect URI.
   - Apple provider: Client IDs `app.savvo,<Services ID>` and a client-secret JWT that Apple expires every 6 months. Full steps in [ios/DEPLOY-IOS.md](ios/DEPLOY-IOS.md) (Setup D).
   - Optional: enable CAPTCHA (Turnstile) and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in the app.
   - Production uses custom SMTP through Resend, with branded templates.

Check that the Raise Autopilot tables exist with `npm run verify:raise-autopilot-live`.

## 4. Third-party services

**Google Cloud** (Calendar sync and Contacts import, separate from Supabase's Google sign-in): enable the Calendar and People APIs and add these redirect URIs:
- `<APP_URL>/api/calendar/connect/callback`
- `<APP_URL>/api/import/google/callback`

**Stripe**: create the Pro monthly and yearly prices and a webhook at `<APP_URL>/api/stripe/webhook`. For local testing, run `stripe listen --forward-to localhost:3001/api/stripe/webhook`. `.env.local` on the main dev machine holds **live** keys, so never finish a checkout locally.

**Resend**: verify the sending domain (SPF, DKIM, DMARC). For forwarded-email capture, set up inbound on `RESEND_RECEIVING_DOMAIN` with a webhook to `<APP_URL>/api/webhooks/resend`.

**RevenueCat** (iOS only): webhook to `<APP_URL>/api/native/revenuecat-webhook` with `REVENUECAT_WEBHOOK_AUTH` as the authorization header.

**Upstash**: create a Redis database and copy the REST URL and token.

## 5. Scheduled jobs

Defined in `vercel.json` and authenticated with `CRON_SECRET`:

| Route | Schedule (UTC) | Job |
|---|---|---|
| `/api/cron/daily-digest` | 14:00 Mon–Fri | Digest email (daily for Pro, Monday for Free) |
| `/api/cron/push-moves` | 15:00 Mon–Fri | Push the most urgent promise, pending reviews, or intro follow-ups to people with the app |
| `/api/calendar/sync` | 18:00 daily | Pull calendar events for connected users |
| `/api/cron/cleanup-unverified` | 03:00 Sunday | Remove stale unverified signups |

Locally, trigger a digest with `POST /api/dev/trigger-digest` and the `DEV_SECRET` header.

## 6. Testing

```bash
npx tsc --noEmit
npx vitest run
```

Browser E2E personas (pre-confirmed `@example.com` users) can be seeded and removed with:

```bash
E2E_PASSWORD=... node --env-file=.env.local scripts/e2e/seed-users.mjs
node --env-file=.env.local scripts/e2e/cleanup-users.mjs
```

After changing the embedding model or extraction logic, run `npx tsx scripts/re-embed.ts` (or `POST /api/dev/re-embed`) to backfill embeddings.

## 7. Deploying

Git auto-deploy is disabled (`vercel.json`). Deploy from an up-to-date local `main`:

```bash
npx tsc --noEmit && npx vitest run && npx next build
vercel --prod
bash .claude/hooks/post-deploy-smoke.sh
```

Apply any new migration to production **before** deploying code that depends on it. After adding public pages, resubmit the sitemap in Google Search Console.

iOS: see [ios/DEPLOY-IOS.md](ios/DEPLOY-IOS.md).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every email login fails with `captcha_failed` | CAPTCHA is on in Supabase but `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset |
| All API calls return 429 under `next start` | Upstash variables missing (rate limiter fails closed) |
| Boot log says "Missing required environment variable" | Set it in `.env.local` or Vercel project settings |
| Search returns nothing for new contacts | Embedding failed; check the contact's embedding status or re-embed |
| `next dev` page loads but nothing is clickable | Dev CSP problem; `next.config.ts` adds `unsafe-eval` only when `NODE_ENV=development` |
| Local Supabase calls blocked by CSP | In development the CSP allows `NEXT_PUBLIC_SUPABASE_URL`'s origin; restart `next dev` after changing it |
| Crons do nothing | `CRON_SECRET` missing or different from the Vercel value |
