# Savvo

AI-powered relationship manager. Keep every connection alive.

Savvo is for founders, VCs, and professional networkers who meet many people a week. You paste rough notes after a meeting; Savvo pulls out a structured contact, scores each relationship's health, and tells you who is going cold and what to do next. The current wedge is **founders raising a round**: an investor CRM with follow-up tracking and AI meeting prep.

Live at [savvo.app](https://savvo.app). An iOS wrapper (Capacitor) ships the same web app.

## Features

**Capture**
- Free-form notes → structured contact (AI extraction with hallucination stripping)
- LinkedIn "Share Profile" URLs, QR code scan (e.g. a LinkedIn QR at an event), CSV import with column mapping, Google Contacts import
- Meeting capture from pasted notes, Granola sync, and forwarded emails (signed per-user inbound address via Resend)

**Stay on top of it**
- Relationship health scores (green / amber / red) with per-contact cadence and snooze
- Dashboard, `/reach-out` (who needs attention), and `/moves` (ranked next actions)
- **Raise Autopilot**: AI analyzes each meeting into a proposed contact update, commitments, and a follow-up draft. Nothing changes until you approve it in the after-call inbox (`/inbox`)
- Commitments tracking, daily (Pro) or weekly (Free) digest email, Google Calendar sync

**Intelligence**
- Hybrid search: vector + keyword with Reciprocal Rank Fusion
- AI meeting prep briefs, draft follow-up messages, intro suggestions and double-opt-in intro requests
- Network graph (d3)

**Account and platform**
- Email/password (Turnstile CAPTCHA), Google, and Sign in with Apple, TOTP 2FA, 24h idle logout
- Push notifications in the app: promises due, meeting notes to review, intro follow-ups
- Stripe (web) and RevenueCat (iOS) billing, GDPR export, atomic account deletion
- Duplicate detection, merge, and merge-undo

**Marketing site** (static): homepage, `/pricing`, `/vs/*` comparison pages, `/blog`, `/templates/investor-tracker`, `/from-spreadsheet`, `/changelog`, `rss.xml`, `sitemap.xml`, `llms.txt`.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 (class-based dark mode), Radix primitives, lucide icons |
| Data and auth | Supabase (Postgres + pgvector, RLS, Auth, MFA) |
| AI | OpenAI (extraction, embeddings, drafts, analysis); optional Google AI fallback for extraction |
| Email | Resend (transactional, digest, inbound) |
| Payments | Stripe (web), RevenueCat (iOS in-app purchase) |
| Rate limiting | Upstash Redis |
| Observability | Sentry, PostHog, Vercel Analytics + Speed Insights |
| Hosting | Vercel (crons in `vercel.json`) |
| Mobile | Capacitor iOS (loads savvo.app) |
| Tests | Vitest |

## Quick start

Requires Node 20.9+ and a Supabase project.

```bash
npm install
cp .env.local.example .env.local   # fill in values, see SETUP.md
PORT=3001 npm run dev               # http://localhost:3001
```

Use port **3001**; 3000 is reserved for another project on the main dev machine. Full setup (database, OAuth, Stripe, Resend, crons, iOS) is in [SETUP.md](SETUP.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (webpack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` / `npm run test:coverage` | Watch mode / coverage |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run verify:raise-autopilot-schema` | Check the Raise Autopilot migration SQL |
| `npm run verify:raise-autopilot-live` | Check the migration is applied to the live database |
| `npm run ios:sync` / `npm run ios:open` | Sync / open the Capacitor iOS project |

## Project layout

```
src/
  app/
    (auth)/login/      sign in, sign up, password reset
    (dashboard)/       authenticated app: dashboard, contacts, contact/[id], add, capture,
                       inbox, moves, reach-out, search, graph, intros, import, scan, settings
    api/               route handlers (contacts, reviews, commitments, intro-requests,
                       import, search, calendar, granola, stripe, native, cron, webhooks, dev)
    blog/ vs/ templates/ pricing/ changelog/ ...   static marketing pages
  components/          UI components
  lib/                 domain logic: health scores, dedup, extraction, search, next moves,
                       intro paths, email, Stripe/RevenueCat, rate limiting, env validation
  __tests__/           unit tests; integration/ holds user-flow and API handler tests
supabase/migrations/   SQL migrations (see supabase/README.md)
supabase-schema.sql    base schema
scripts/               re-embed, migration verifiers, e2e persona seed/cleanup
ios/                   iOS deploy guide and App Store metadata
.claude/hooks/         post-deploy smoke test
```

## Quality gates

Before merging (full list in [CLAUDE.md](CLAUDE.md)):

1. `npx tsc --noEmit` and `npx vitest run` pass
2. New user-facing flows get an integration test in `src/__tests__/integration/`
3. Every `.from("contacts")` query filters `.is("archived_at", null)` unless it is meant to read archived rows
4. Mutations to contact data call `revalidatePath` for `/dashboard`, `/reach-out`, `/contacts`
5. Light and dark mode both meet the contrast rules

Before deploying: `npx next build`, then `vercel --prod` from local `main` (Git auto-deploy is off), then `bash .claude/hooks/post-deploy-smoke.sh`.

## Other docs

| File | Contents |
|---|---|
| [SETUP.md](SETUP.md) | Environment, services, and deployment setup |
| [CLAUDE.md](CLAUDE.md) | Design context, quality gates, testing rules |
| [TODOS.md](TODOS.md) | Shipped work, in-progress items, roadmap |
| [supabase/README.md](supabase/README.md) | Migration conventions |
| [ios/DEPLOY-IOS.md](ios/DEPLOY-IOS.md) | iOS build and App Store submission |
| [DISTRIBUTION-PLAYBOOK.md](DISTRIBUTION-PLAYBOOK.md), [IDEAL-CUSTOMER-PROFILE.md](IDEAL-CUSTOMER-PROFILE.md), [OUTREACH-SEQUENCES.md](OUTREACH-SEQUENCES.md), [GEO-AUDIT-REPORT.md](GEO-AUDIT-REPORT.md) | Go-to-market |
| [REDDIT-POSTS.md](REDDIT-POSTS.md), [TWITTER-THREAD.md](TWITTER-THREAD.md) | Launch post drafts |
