# Savvo — TODOs

Generated from CEO Review on 2026-03-19. Updated same day.

## Foundation (P1)

### ~~Add structured logging + error alerting~~ ✅ In Progress
- **Status:** Logger utility being built. Sentry integration deferred.

### ~~Wrap account deletion in transaction~~ ✅ Done (Batch A)
- Supabase RPC `delete_user_account()` wraps all deletes in a transaction.

### ~~Add withAuth API wrapper~~ ✅ Done (Batch A)
- `lib/api-utils.ts` — `authenticateRequest()` used across all 20+ routes.

### ~~Gitignore supabase/.temp/~~ ✅ Done (Batch A)

## Quality (P2)

### ~~Centralize OpenAI client with retry + timeout~~ ✅ Done (Batch A)
- `lib/openai.ts` — 30s timeout, 2x retry, 10KB input limit.

### ~~Track embedding status per contact~~ ✅ In Progress
- DB column created (Batch A). UI indicator + retry button being built.

### ~~Add AI extraction validation~~ ✅ Done (Batch A)
- `lib/validate-extraction.ts` — strips hallucinated emails, phones, URLs.

## Accepted Feature Expansions

### ~~Contact deduplication~~ ✅ Done (Batch B)
- `lib/dedup.ts` — scoring function + integrated into create, LinkedIn, CSV import.

### ~~Pagination + virtualized lists~~ ✅ Done (Batch B)
- Cursor-based pagination on contacts API + "Load More" UI.

### ~~Onboarding flow~~ ✅ Done (Batch B)
- 3-step: welcome wizard → getting-started banner → normal dashboard.

### ~~Contact activity timeline~~ ✅ In Progress
- DB migration done (Batch A). API + UI being built.

### ~~Test suite~~ ✅ Done (Batch A + B)
- 47 tests: health scores, extraction validation, dedup, API utils, plan limits.

### ~~Soft delete (undo)~~ ✅ In Progress
- DB migration + RLS done (Batch A). UI (recently deleted, restore) being built.

## Deferred (Future Milestones)

- Team plan ($12/user/mo — shared graphs, intro requests, admin tools)
- PWA push notifications (replace email digest for mobile-first users)
- Contact photo/avatar upload
- Bulk tag operations
- Export graph as image
- AI intro suggestions (recommend contacts who should know each other)
- Meeting prep briefs (pre-meeting context + conversation starters)
- Network intelligence analytics (network composition, blind spots)
