# Savvo — TODOs

Generated from CEO Review on 2026-03-19. Updated 2026-10-01 (shipped log backfilled from git history through 2026-07-21).

## Completed (v0.1 — shipped 2026-03-19)

- ~~Structured logging~~ — `lib/logger.ts` + critical paths (contacts, Stripe, cron, account deletion)
- ~~Atomic account deletion~~ — Supabase RPC `delete_user_account()`
- ~~withAuth API wrapper~~ — `lib/api-utils.ts` across all 20+ routes
- ~~Gitignore cleanup~~ — `supabase/.temp/` excluded
- ~~Centralized OpenAI client~~ — `lib/openai.ts` with 30s timeout, 2x retry, 10KB limit
- ~~Embedding status tracking~~ — DB column + UI indicator + retry button
- ~~AI extraction validation~~ — `lib/validate-extraction.ts` strips hallucinated fields
- ~~Contact deduplication~~ — `lib/dedup.ts` + integrated into create, LinkedIn, CSV import
- ~~Pagination~~ — Cursor-based API + "Load More" UI
- ~~Onboarding flow~~ — 3-step: welcome wizard → getting-started banner → normal dashboard
- ~~Activity timeline~~ — `contact_activities` table + API + UI (replaces raw_note meetings)
- ~~Test suite~~ — 47 tests: health scores, extraction validation, dedup, API utils, plan limits
- ~~Soft delete~~ — `archived_at` column + RLS + "Recently Deleted" UI + restore
- ~~Security hardening~~ — Stripe webhook verification, OAuth HMAC state, input length limits, prompt injection defense

## Completed (v0.2 — shipped 2026-03-19)

- ~~Free tier weekly digest~~ — Free users now get weekly Monday digest (Pro keeps daily). Cron route processes all users, not just Pro.
- ~~Richer digest emails~~ — Network health summary bar, last activity context, next steps reminders, upgrade CTA for free users, manage preferences link.
- ~~Sentry integration~~ — `@sentry/nextjs` with client/server/edge configs, global error handler, instrumentation hook, replay integration.
- ~~Meeting prep briefs~~ — `POST /api/contacts/[id]/prep` generates AI-powered meeting context: key points, conversation starters, follow-ups, strategic angle. Pro feature with UI button on contact detail.
- ~~AI intro suggestions~~ — `GET /api/intros` analyzes contacts' industries, roles, tags, and shared context to recommend high-value introductions with draft intro messages. New `/intros` page with copy-to-clipboard. Pro feature.
- ~~Expanded test suite~~ — 78 tests (up from 47): digest selection algorithm, email template rendering, plan limits, extraction pipeline with fallbacks, rate limiting, structured logger.

## Completed (v0.3 — shipped 2026-03-24/25)

### Onboarding & Personalization
- ~~Hyperpersonalized welcome experience~~ — networking goal picker (fundraising/hiring/partnerships/sales/community/general), time-of-day greeting, company inference from email domain
- ~~Walkthrough tooltip tour~~ — 4-step spotlight tour for users with 1-4 contacts highlighting stats, reach-out, and add contact
- ~~Onboarding checklist~~ — persistent card tracking 4 milestones (add contact, view profile, try search, check dashboard) with auto-completion
- ~~Post-first-contact confetti celebration~~ — particle burst animation on first contact creation
- ~~Personalized dashboard header~~ — goal-aware subtitle ("Your investor pipeline" vs "Your talent pipeline")
- ~~Personalized add contact placeholder~~ — goal-specific example text per networking goal

### GEO & Marketing
- ~~robots.txt~~ — AI crawler directives (GPTBot, ClaudeBot, PerplexityBot allowed)
- ~~sitemap.xml~~ — all public pages with priorities
- ~~llms.txt~~ — full product description for AI systems
- ~~JSON-LD schema~~ — Organization + SoftwareApplication + WebSite + FAQPage on root layout
- ~~8 FAQ section~~ — expand/collapse on homepage with FAQPage schema
- ~~/from-spreadsheet landing page~~ — SEO-optimized page targeting spreadsheet users with comparison, pain→solution cards, import CTA
- ~~Homepage "Using a spreadsheet?" link~~ — in hero section linking to /from-spreadsheet

### Security (Enterprise-Grade)
- ~~CRITICAL: Dev endpoints production-gated~~ — `NODE_ENV === "production"` check, returns 404
- ~~HIGH: Timing-safe secret comparisons~~ — `crypto.timingSafeEqual` on all 4 secret-protected routes (dev, cron, welcome, calendar sync)
- ~~HIGH: All contact fields sanitized in AI prompts~~ — name, company, job_title through `sanitizeForPrompt()` in draft, prep, and intros
- ~~MEDIUM: Account deletion cleanup~~ — now deletes tags, events, teams, team_members, user_preferences, contact_tags
- ~~MEDIUM: Contact limit aligned~~ — DB trigger matches app layer (50, was 25)
- ~~MEDIUM: CSP hardened~~ — removed `unsafe-eval`, added HSTS `preload`
- ~~MEDIUM: Rate limit warning~~ — logs warning in production when Redis unavailable
- ~~MEDIUM: Calendar sync rate limited~~ — 5/hr per user
- ~~MEDIUM: Tag UUID validation~~ — validates UUID format before DB insert

### UX Improvements
- ~~Staggered fade-in animations~~ — dashboard cards, contact grids
- ~~Card hover/press effects~~ — `card-interactive` class
- ~~Mobile polish~~ — 44px touch targets, smooth scroll, overscroll prevention, iOS tap highlight
- ~~Reusable EmptyState component~~ — consistent empty state pattern
- ~~Theme toggle moved to Settings~~ — light/dark/system selector in Appearance section

### Bug Fixes
- ~~Archived contacts leaking~~ — 6 queries missing `.is("archived_at", null)` fixed (contacts list, paginated API, export, LinkedIn dedup, plan count, backward-compat API)
- ~~Stale health scores~~ — `force-dynamic` on dashboard/contacts/reach-out + `revalidatePath` on activity create, contact update, contact delete
- ~~Green contacts in Reach Out~~ — excluded green-health contacts from follow_up_needed priority
- ~~Smart search 0 results~~ — lowered similarity threshold 0.5→0.3, fallback to keyword on embedding failure, case-insensitive query normalization

### Features
- ~~"Message" activity type~~ — violet themed, added to UI + types + API + DB constraint
- ~~Full activity timeline~~ — "Added" anchor at bottom with copper dot, created_at date, how_we_met/import source
- ~~/reach-out page~~ — dedicated page showing only contacts needing attention (linked from dashboard "View all")
- ~~Follow-ups Pending section~~ — separate amber-themed dashboard card with trigger dates, context, urgency indicators
- ~~Hybrid search (Azure AI Search-style)~~ — parallel vector + keyword with Reciprocal Rank Fusion, recency/exact-match/health boosting, faceted filters (company + health status)
- ~~Branded email verification page~~ — /auth/verify with Savvo branding
- ~~Improved signup confirmation~~ — "Can't find it?" help box with spam/sender/timing tips

## Completed (v0.4 — April 2026)

- ~~Scheduling + cadence~~ — one-off follow-up dates, per-contact cadence, propagated into reach-out and digest
- ~~Dedup gold standard~~ — `namesAgree` safety check, unique active email per user, in-memory dedup for bulk imports, merge undo, LinkedIn duplicate 409
- ~~Account security~~ — TOTP 2FA (Supabase MFA), 24h idle logout across tabs, security.txt, GDPR data export
- ~~Product polish~~ — contacts sort dropdown, Pro upgrade dialog, PostHog analytics, PWA install prompt + /install guide, public /changelog, humanized error toasts

## Completed (v0.5 — May–June 2026)

- ~~Runtime hardening~~ — boot-time env validation (`lib/env.ts`), import embedding jobs in `after()`, handler-invocation integration tests for all mutating routes, dependency CVE patches
- ~~Activation~~ — single-action welcome screen, new-user nudge emails, signup CRO + inline validation, landing repositioned to investor-CRM wedge, loading skeletons on 12 pages
- ~~iOS app~~ — Capacitor wrapper, RevenueCat IAP (signed attribute, fail-closed), native Google sign-in, universal links, safe-area
- ~~Performance~~ — static homepage, parallelized dashboard/contacts/search queries, embedding vectors no longer shipped on reads

## Completed (v0.6 — July 2026)

- ~~SEO + distribution pages~~ — og image, per-page metadata, `/vs/{airtable,streak,attio,notion}`, `/templates/investor-tracker`, `/blog` (3 posts) + RSS, sitemap route
- ~~Critical login fix~~ — Turnstile captcha token on all captcha-gated auth calls (email login was failing in prod)
- ~~E2E persona fixes~~ — dark mode persistence, MFA QR render, digest plan gating, archive undo refresh, merged notes visible, draft button rendered, CSV count off-by-one
- ~~Account deletion hardening~~ — residual data removed; migration `20260715200000`
- ~~PeerPush attribution funnel~~ — durable first-touch UTM attribution (`lib/attribution.ts`) carried through signup
- ~~Raise Autopilot core loop~~ — meeting capture (manual, Granola, forwarded email) → AI review proposal → human approval in `/inbox` → atomic apply; commitments; `/moves` ranked next actions; migration `20260717120000`
- ~~Intro requests~~ — intro paths + `intro_requests` table (copy-to-clipboard; hosted double-opt-in still open)
- ~~Merge fix~~ — active-email ordering in contact merges; migration `20260720120000`

## Next Up (audit 2026-10-01)

### Bugs (confirmed in code)
- [ ] **Digest skips users** — `api/cron/daily-digest/route.ts:41` builds the user list from an unpaginated `contacts` select (Supabase caps at 1,000 rows); users outside that window get no digest. Zero-contact users are never emailed. Loop is serial per user (timeout risk). List users from subscriptions/auth and batch. (S)
- [ ] **Calendar sync ignores null last_contact_date** — `api/calendar/sync/route.ts:325,423` use `.lt(...)`; NULL never matches, so imported contacts never warm up after a meeting. Use `.or("last_contact_date.is.null,last_contact_date.lt.<date>")`. (S)
- [ ] **Follow-up lists disagree (handoff #11)** — Next Moves (`lib/next-moves.ts:184`), Follow-ups Pending (`dashboard/page.tsx:207`) and Reach Out (`dashboard/page.tsx:148`, `reach-out/page.tsx:83`) use three different rules; cooling tier added only when <5 on dashboard. Extract one shared ranking function. (M)
- [ ] **Walkthrough step 3 skipped (handoff #12)** — targets reach-out card, which renders nothing for new (healthy) contacts. Rebuild for the capture-first flow or remove. (S)
- [ ] **CSV import is O(rows x contacts)** — `api/import/csv/route.ts:239` calls `findDuplicates()` per row, which selects `*` incl. embeddings (`lib/dedup.ts:202`). Reuse `existingContacts`, drop the embedding column. (S)
- [ ] **Capture/inbox 500-contact cap** — `capture/page.tsx:22`, `inbox/page.tsx:22`; `/capture?contact=<id>` silently drops contacts outside the first 500. Fetch preselected contact separately; searchable picker. (S)
- [ ] **Quality-gate gaps** — missing `revalidatePath` in `api/contacts` POST, `contacts/linkedin`, `import/google` POST, `calendar/sync`, `duplicates/dismiss`; missing `archived_at` filter in `api/events/active/route.ts:26`. (S)
- [ ] **Dead personalization** — nothing writes `user_metadata.networking_goal` since the goal picker was removed, but header/walkthrough/add page read it; welcome/checklist/next-moves hardcode fundraising copy. (S)
- [ ] **Free import mismatch** — UI checks `totalRows > 5` pre-dedupe and ignores remaining lifetime allowance; dashboard hides Import for free users while onboarding promotes "Import five". (S)
- [ ] `lib/env.ts` comment claims OAuth state falls back to `CRON_SECRET`; `lib/calendar-oauth-state.ts` throws instead. (S)

### Product improvements
- [ ] **Raise Autopilot in the digest** — due/overdue commitments, pending reviews, intro follow-ups ("You promised Sarah the deck by Friday"). (M)
- [ ] **Zero-contact nudge emails** — 2-email "paste your last meeting notes" sequence. (S)
- [ ] **One action list** — make Next Moves the single prioritized dashboard list (also fixes #11). (M)
- [ ] Dashboard commitments/reviews/intro queries: filter to open statuses like `/moves` does (`dashboard/page.tsx:59-73`). (S)
- [ ] Scheduled Granola sync (cron, like calendar). (S)
- [ ] "Going Cold" caption says 90+ days but cadence makes it earlier (`dashboard/page.tsx:369`). (S)
- [ ] Remove dead code: `registerPushNotifications` (`lib/native/capacitor.ts:102`), `components/empty-state.tsx`, `components/onboarding-banner.tsx`. (S)

### Growth levers in code
- [ ] **Template → signup → import funnel** — free CSV import cap (5) blocks the free 30-row investor template; allow up to the 50-contact limit, add "upload your filled tracker" on `/templates/investor-tracker`. (S)
- [ ] **Fire `first_contact_created` on every path** — only `add/page.tsx:107` today; add import, capture, Granola, inbox approve. (S)
- [ ] **Generic `campaign_arrival` event** — `posthog-provider.tsx:163` only tracks PeerPush; add `pro_upgraded` with attribution from the Stripe webhook. (S)
- [ ] Remove expired promo branch in `pricing/page.tsx:105`; align ICP/outreach docs to $8. (S)
- [ ] Referral program (`/r/[code]` reusing first-touch attribution, credit in `auth/callback`, Stripe coupon). (M)
- [ ] Shareable "raise snapshot" public link with Savvo footer. (M)
- [ ] Hosted double-opt-in intro page (intro_requests already exist; copy-only today; consider 1–2/mo for free). (L)

### Distribution (30-day plan, owner: founder)
Every asset is written; none has been posted. Bottleneck is outbound time, not product.
1. Days 1–30: ~15/day hand-sourced founders actively raising (raise announcements, accelerator demo-day lists, Luma pitch events). Sequence 1 from `OUTREACH-SEQUENCES.md`, trimmed to 3 emails, raise angle; offer "I'll import your investor spreadsheet for you" (concierge onboarding + interview). Per-link UTMs.
2. Day 1: post `TWITTER-THREAD.md`, rewritten around the raise story; weekly build-in-public from `/changelog`.
3. Days 2–7: F5Bot-driven helpful replies (playbook §3), max 1–2/sub/week.
4. Week 1: accelerator program managers / community builders (Sequence 3): offer the investor template to the whole cohort.
5. Week 1: GSC + Bing + free directories (playbook §2, §4), each with its own UTM.
6. Week 3: Product Hunt only after 20+ real users; then r/startups posts.
7. Ongoing: one fundraising-intent blog post per week linking the template.
Track weekly: touches sent, signups by `first_touch_source`, activation <24h (>50%), week-2 return, user conversations, third-party mentions.

## In Progress

### Email Deliverability (manual — Supabase dashboard)
- [x] Custom SMTP via Resend in Supabase Auth settings
- [x] Custom email templates (signup, magic link, reset password, invite, change email)
- [x] DNS records: SPF, DKIM, DMARC in Namecheap

### First 10 Users (design doc: ~/.gstack/projects/nb110240-neils-network/)
- [x] Verify SMTP delivers to Gmail, Outlook, iCloud inbox (Day 0 gate)
- [x] Write Twitter/X building-in-public thread (TWITTER-THREAD.md)
- [x] Set up F5Bot alerts for personal CRM keywords
- [ ] **Post thread on Twitter/X** ← NEXT ACTION
- [ ] Share on Reddit r/SideProject, Indie Hackers
- [ ] Update welcome email to ask "what are you hoping Savvo helps with?"
- [ ] Run activation tracking SQL daily
- [ ] 3+ conversations with real users

## Deferred (Future Milestones)

### 10-Star Features (dreamed 2026-03-24)

- **Network Score** — single 0-100 gamified score on dashboard (recency, coverage, growth, diversity, follow-through). Animated ring chart + breakdown tooltip. $0 cost, pure SQL. ~1 day.
- **Double-Opt-In Intro Flow** — act on intro suggestions: draft both messages, user approves/edits, send or copy. New `intro_requests` table. Tracks as activity on both contacts. Growth engine. ~$0.50/mo at 100 users. ~2-3 days.
- **Voice Note Input** — mic button → Whisper API transcription → existing extraction pipeline. 30-60s post-meeting debrief creates a full contact. Pro feature. ~$3/mo at 100 users. ~1-2 days.
- **Smart Daily Brief v2** — AI-written 3-sentence personalized digest (today's meetings, who's going cold, follow-up reminders, network score delta). Replaces template digest for Pro users. ~$1/mo at 100 users. ~1 day.
- **PWA + Push Notifications** — installable on mobile, Web Push API for daily brief + follow-up reminders. VAPID keys, service worker, push subscription table. $0 cost. ~1-2 days.

### Other Deferred

- **Referral Program** — each referral earns the referrer 1 free month of Pro. Unique referral links, tracking table, Stripe coupon automation. Viral growth loop.
- Team plan ($12/user/mo — shared graphs, intro requests, admin tools)
- Contact photo/avatar upload
- Bulk tag operations
- Export graph as image
- Network intelligence analytics (network composition, blind spots)
- Ambient network intelligence (proactive suggestions based on network signals)
- Goal-linked networking ("I'm raising a Series A" → prioritize investor contacts)
- AI relationship coach (pattern detection + re-engagement strategies)
- Second brain for people (synthesized profiles from all interactions)
