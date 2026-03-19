# Savvo — TODOs

Generated from CEO Review on 2026-03-19.

## Foundation (P1)

### Add structured logging + error alerting
- **What:** Replace console.log/error with structured logging. Add Sentry or Vercel Log Drain for error alerting.
- **Why:** Zero production visibility today. When things break, nobody knows until a user complains.
- **Effort:** S (human: ~2 days / CC: ~15 min)
- **Depends on:** Git repo (so config can be committed)

### Wrap account deletion in transaction
- **What:** Account deletion (`DELETE /api/settings/delete-account`) runs 6 sequential deletes with no transaction. If step 3 fails, user has orphaned data.
- **Why:** Data integrity — partial deletes leave ghost records that can cause bugs.
- **Effort:** S (human: ~1 day / CC: ~10 min)
- **Approach:** Create Supabase RPC function (stored procedure) that wraps all deletes in a transaction.

### Add withAuth API wrapper
- **What:** Centralize auth + rate-limit boilerplate across all 30 API routes into a `withAuth(handler)` wrapper in `lib/api-utils.ts`.
- **Why:** Same 5-line auth block repeated in every route. If the auth pattern changes, 30 files need updating.
- **Effort:** S (human: ~2 days / CC: ~15 min)
- **Approach:** Create wrapper that handles: create Supabase client, get user, check null (401), rate limit check (429). Apply during Batch A while touching routes for other changes.

### Gitignore supabase/.temp/
- **What:** Add `supabase/.temp/` to `.gitignore` — these are CLI state files accidentally committed.
- **Effort:** Trivial

## Quality (P2)

### Centralize OpenAI client with retry + timeout
- **What:** 5 routes create OpenAI clients independently. No retry logic, no timeout config, no input length validation.
- **Why:** Silent failures + potential runaway API costs from oversized inputs.
- **Effort:** S (human: ~1 day / CC: ~10 min)
- **Approach:** Create `lib/openai.ts` with shared client, 30s timeout, 2x retry, 10KB input limit.

### Track embedding status per contact
- **What:** Add `embedding_status` column ('pending', 'complete', 'failed') to contacts table. Show indicator on contacts with failed embeddings. Retry on relevant action.
- **Why:** Embedding failures are currently silent — contacts exist but are invisible to semantic search.
- **Effort:** S (human: ~2 days / CC: ~15 min)
- **Depends on:** DB migration

### Add AI extraction validation
- **What:** Validate AI-extracted fields before storage. Email must match email regex, phone must match phone pattern, website must be valid URL.
- **Why:** GPT-4o-mini can hallucinate fields (e.g., invent email addresses). Users trust stored data.
- **Effort:** S (human: ~1 day / CC: ~10 min)

## Accepted Feature Expansions

### Contact deduplication
- **What:** Detect and merge duplicate contacts by name+email+company similarity. Run on import and manual add.
- **Why:** Nothing prevents importing the same person twice. Duplicates undermine health scores and search.
- **Effort:** M (human: ~1 week / CC: ~30 min)

### Pagination + virtualized lists
- **What:** Cursor-based pagination on contacts list, lazy loading on dashboard, virtualized graph rendering.
- **Why:** Current "fetch all" pattern breaks at 500+ contacts. Pro users are unlimited.
- **Effort:** M (human: ~1 week / CC: ~30 min)

### Onboarding flow
- **What:** 3-step guided experience for new users. Explain health scores, guide first contact add, show value immediately.
- **Why:** Directly impacts activation rate — the #1 metric for a new product.
- **Effort:** S (human: ~3 days / CC: ~20 min)

### Contact activity timeline
- **What:** New `contact_activities` table replacing raw_note meeting storage. Proper timestamps, types, undo support.
- **Why:** Current raw_note approach is fragile — no timestamps, breaks on edit, no structured history.
- **Effort:** M (human: ~1 week / CC: ~30 min)
- **Depends on:** DB migration, data migration for existing meetings

### Test suite
- **What:** Comprehensive tests: API route auth/validation/plan gating, health score calculation, AI extraction, Stripe webhooks.
- **Why:** Zero test coverage for a product handling user data and payments.
- **Effort:** L (human: ~2 weeks / CC: ~1 hour)
- **Framework:** Vitest recommended

### Soft delete (undo)
- **What:** `archived_at` timestamp on contacts, 30-day retention, "Recently Deleted" section in settings.
- **Why:** Permanent deletion is too dangerous for relationship data. One mis-tap = months of context lost.
- **Effort:** S (human: ~2 days / CC: ~15 min)

## Deferred (Future Milestones)

- Team plan ($12/user/mo — shared graphs, intro requests, admin tools)
- PWA push notifications (replace email digest for mobile-first users)
- Contact photo/avatar upload
- Bulk tag operations
- Export graph as image
- AI intro suggestions (recommend contacts who should know each other)
- Meeting prep briefs (pre-meeting context + conversation starters)
- Network intelligence analytics (network composition, blind spots)
