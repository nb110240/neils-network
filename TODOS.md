# Savvo — TODOs

Generated from CEO Review on 2026-03-19. Updated 2026-03-25.

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

## In Progress

### Email Deliverability (manual — Supabase dashboard)
- [ ] Custom SMTP via Resend in Supabase Auth settings
- [ ] Custom email templates (signup, magic link, reset password, invite, change email)
- [ ] DNS records: SPF, DKIM, DMARC in Namecheap

### First 10 Users (design doc: ~/.gstack/projects/nb110240-neils-network/)
- [ ] Verify SMTP delivers to Gmail, Outlook, iCloud inbox (Day 0 gate)
- [ ] Write Twitter/X building-in-public thread
- [ ] Post on Reddit r/SideProject, Indie Hackers
- [ ] Set up F5Bot alerts for personal CRM keywords
- [ ] Update welcome email to ask "what are you hoping Savvo helps with?"
- [ ] Run activation tracking SQL daily
- [ ] 3+ screenshare/conversation sessions with real users

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
