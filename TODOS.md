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

## Deferred (Future Milestones)

- Team plan ($12/user/mo — shared graphs, intro requests, admin tools)
- PWA push notifications (replace email digest for mobile-first users)
- Contact photo/avatar upload
- Bulk tag operations
- Export graph as image
- AI intro suggestions (recommend contacts who should know each other)
- Meeting prep briefs (pre-meeting context + conversation starters)
- Network intelligence analytics (network composition, blind spots)
- Sentry integration (currently using structured console logging)
