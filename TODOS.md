# Savvo — TODOs

Generated from CEO Review on 2026-03-19. All v0.1 items shipped same day.

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

## Deferred (Future Milestones)

### 10-Star Features (dreamed 2026-03-24)

- **Network Score** — single 0-100 gamified score on dashboard (recency, coverage, growth, diversity, follow-through). Animated ring chart + breakdown tooltip. $0 cost, pure SQL. ~1 day.
- **Double-Opt-In Intro Flow** — act on intro suggestions: draft both messages, user approves/edits, send or copy. New `intro_requests` table. Tracks as activity on both contacts. Growth engine. ~$0.50/mo at 100 users. ~2-3 days.
- **Voice Note Input** — mic button → Whisper API transcription → existing extraction pipeline. 30-60s post-meeting debrief creates a full contact. Pro feature. ~$3/mo at 100 users. ~1-2 days.
- **Smart Daily Brief v2** — AI-written 3-sentence personalized digest (today's meetings, who's going cold, follow-up reminders, network score delta). Replaces template digest for Pro users. ~$1/mo at 100 users. ~1 day.
- **PWA + Push Notifications** — installable on mobile, Web Push API for daily brief + follow-up reminders. VAPID keys, service worker, push subscription table. $0 cost. ~1-2 days.

### Other Deferred

- Team plan ($12/user/mo — shared graphs, intro requests, admin tools)
- Contact photo/avatar upload
- Bulk tag operations
- Export graph as image
- Network intelligence analytics (network composition, blind spots)
- Ambient network intelligence (proactive suggestions based on network signals)
- Goal-linked networking ("I'm raising a Series A" → prioritize investor contacts)
- AI relationship coach (pattern detection + re-engagement strategies)
- Second brain for people (synthesized profiles from all interactions)
