# HANDOFF: Distribution batch + E2E fixes (for Codex)

Written 2026-07-15 by Claude Code mid-task at the user's request. Branch: `growth/distribution-batch` (branched off main at 649d6fc, which is deployed to prod). **Nothing on this branch is committed.** Working tree state: `git status` shows 15 modified + 8 untracked paths; `npx tsc --noEmit` PASSES and `npx vitest run` is 554/554 GREEN as of this handoff.

## Context: what this branch is

Two workstreams, both nearly done:

1. **Distribution batch** (the growth bottleneck): 4 comparison pages (`src/app/vs/{airtable,streak,attio,notion}/`, shared components in `src/app/vs/shared.tsx`), free template page (`src/app/templates/investor-tracker/` + `public/templates/investor-pipeline-tracker.csv`), blog (`src/app/blog/` 3 posts + `src/lib/blog-posts.ts` manifest + `src/app/rss.xml/route.ts`), launch playbook (`DISTRIBUTION-PLAYBOOK.md`, docs-only), sitemap/llms.txt/homepage-footer integration. ALL BUILT AND VERIFIED: every route 200 on dev, all static (○) in build, sitemap has 16 URLs pinned by test, facts fact-checked with sources (see agent reports summary below).

2. **E2E bug fixes** from a full browser E2E run as a free-plan persona (52 screenshots under /tmp/e2e-free/). 13 bugs found; 11 fixed on this branch, 2 low deferred.

## THE CRITICAL FIX ON THIS BRANCH (ship ASAP)

**Production email/password login is broken on savvo.app.** The Supabase project has captcha protection enabled, but `signInWithPassword` sent no captchaToken → every email login returns 400 `captcha_failed`. Verified independently: POST to `<supabase>/auth/v1/token?grant_type=password` without token returns `{"error_code":"captcha_failed"}`. Google OAuth unaffected (why nobody noticed).

Fix is complete in `src/app/(auth)/login/page.tsx`: Turnstile now renders in login AND forgot-password modes; captchaToken sent on signInWithPassword, resetPasswordForEmail, resend (all captcha-gated calls audited); single-use-token retry via existing resetKey/nonce pattern; persistent inline `role="alert"` error with mapped human copy (invalid_credentials, captcha_failed, rate limits) replacing raw-backend-text toasts; unset-TURNSTILE_SITE_KEY environments byte-identical to before. Also fixed in passing: `resend`'s error was never checked (failures showed success toast).

If the rest of the branch needs debate, cherry-pick the login fix to a hotfix branch off main and deploy it first.

## All fixes on this branch (from E2E persona 1)

| Bug | Fix | File(s) | Status |
|---|---|---|---|
| #2 CRITICAL login captcha_failed | see above | (auth)/login/page.tsx | done, tsc+build pass |
| #13 raw error toasts on login | inline mapped errors | same file | done |
| #1 dev CSP breaks hydration (`next dev` totally inert) | 'unsafe-eval' in script-src ONLY when NODE_ENV=development | next.config.ts:42-48 | done, verified live (dev console clean, elements interactive) |
| #3 dark mode lost on navigation | pre-paint bootstrap script in layout head reading savvo-theme (mirrors ThemeSelector semantics: dark/light/absent=system) | src/app/layout.tsx head | done; dead src/components/theme-toggle.tsx deleted (git rm) |
| #10 MFA QR renders literal "data:image/svg+xml;utf-8," | img src instead of dangerouslySetInnerHTML, toQrImageSrc() helper | src/components/mfa-settings.tsx:21-34,186-193 | done |
| #4 free users can "enable" Daily digest (server sends weekly anyway) | Daily option disabled + Crown/Pro badge + /pricing link for free plan; plan passed from settings page's existing fetch | (dashboard)/settings/notifications.tsx + settings/page.tsx:351 | done |
| #5 archive Undo doesn't refresh list | root cause: contacts-client.tsx copied server props to useState once, discarding router.refresh() updates; fixed with render-time prop-sync (also fixes staleness after merge/activity) | contacts-client.tsx:79-89 | done |
| #7 merged raw_note invisible | root cause: getOriginalNote() truncated at the `\n\n---\n\n` separator the merge route itself inserts; now renders full note with line-clamp-6 + Show more | contact/[id]/page.tsx:397-405,640-666 | done |
| #8 DraftMessageButton imported but never rendered | rendered in header actions row with plan fetched on mount; component self-gates free users | contact/[id]/page.tsx:96,138-149,429-435 | done |
| #6 import Pro gate fires after upload+mapping | up-front gate for free plan | (dashboard)/import/page.tsx | **UNVERIFIED — see warning below** |
| #9 CSV count off-by-one (header counted) | count fix + tests | api/import/csv/route.ts + api-import-csv.test.ts | **UNVERIFIED — see warning below** |
| #11 dashboard "Follow-ups Pending 1" vs reach-out "All caught up" contradiction | NOT FIXED (deferred, low) | — | todo next batch |
| #12 walkthrough step 3 silently skipped for new users (reach-out section absent when all contacts healthy) | NOT FIXED (deferred, low) | — | todo next batch |

## ⚠️ WARNING: import fix agent died mid-task

The agent fixing bugs #6/#9 hit a session limit after making its edits (89 lines in import/page.tsx, 12 in csv route, 51 in the test) but BEFORE reporting. tsc and all 554 tests pass, so the edits are coherent, but NOBODY has verified the behavior. Before shipping: (a) read the diff of those 3 files, (b) as a free user confirm /import shows an up-front Pro gate with an Upgrade CTA before any upload, (c) confirm a 1-row CSV shows "1 contact found" for a pro user and a header-only CSV shows 0/disabled, (d) confirm the api-import-csv tests actually pin this.

## What remains (in order)

1. **Verify the import fix** (above).
2. **E2E Persona 2 (pro plan)** — never ran. User: e2e-pro-persona@example.com with the local `E2E_PASSWORD` environment variable, already seeded + subscription row set to pro. Test: login via the FIXED login form (Turnstile may challenge headless; fallback = admin session minting via supabase.auth.admin.generateLink, see persona-1 approach), CSV import using public/templates/investor-pipeline-tracker.csv (full circle), column mapping, dedupe scan/merge, AI draft button (now on contact detail), meeting prep, intros, unlimited semantic search, graph (pro can see it), calendar connect (verify OAuth redirect starts, do NOT complete), trigger-digest via POST /api/dev/trigger-digest with DEV_SECRET header (from .env.local), billing portal button, QR scan page graceful degradation headless, and account-deletion flow on a third user (create e2e-delete-persona@example.com via the same admin pattern). Also E2E the new marketing pages (vs/, templates, blog, rss) in a browser incl. dark mode + mobile viewport.
3. **Fix anything Persona 2 finds.**
4. **Review gauntlet** on the full diff (the repo convention: /review with specialists + codex adversarial + codex review; at minimum run `codex review` and an adversarial pass; every prior batch caught real bugs this way, e.g. a dropped event_id column).
5. **Commit in logical commits** (suggested: distribution pages+integration / login+auth fixes / UX bug fixes / e2e harness+playbook docs). No em dashes in messages. IMPORTANT: `git add` the untracked dirs (public/templates, src/app/blog, src/app/rss.xml, src/app/templates, src/app/vs, src/lib/blog-posts.ts, scripts/e2e, DISTRIBUTION-PLAYBOOK.md) — llms.txt links to /templates/investor-tracker and /blog, so committing without them 404s public links (this exact miss was caught by codex last batch).
6. **Ship** (user approval first): push branch, PR to main via gh, merge, then `vercel --prod` FROM LOCAL main (git auto-deploy is OFF), then `bash .claude/hooks/post-deploy-smoke.sh`. Then delete E2E users: `node --env-file=.env.local scripts/e2e/cleanup-users.mjs` (also removes their data via delete_user_account RPC; persona-1 left 2 contacts + 1 archived dup in the free account).
7. **Post-deploy (user's hands)**: DISTRIBUTION-PLAYBOOK.md has the full submission plan: GSC + Bing setup, 7 free directory submissions, PH launch pack (12:01AM PT Tue-Thu, no upvote solicitation), r/startups seeding rules. Sitemap must be resubmitted in GSC after deploy.

## Environment notes

- Dev server: `PORT=3001 npm run dev` (port 3000 is a different project). It is RUNNING at handoff (started via nohup, log /tmp/savvo-e2e-dev3.log); kill: `lsof -tiTCP:3001 -sTCP:LISTEN | xargs kill`.
- The dev CSP fix is required for ANY browser E2E in dev mode; already applied.
- `.env.local` has LIVE Stripe keys (checkout clicks create real cs_live_ sessions; never complete a payment) and missing UPSTASH_* (prod-mode `next start` fail-closes all APIs 429; `next dev` is fine).
- Browser tool: gstack browse CLI at ~/.claude/skills/gstack/browse/dist/browse (goto/snapshot -i/click @eN/fill/console/screenshot). Persona 1 hit ~7 Chromium crashes on the settings page; plain Playwright is a fallback.
- House rules (CLAUDE.md): tsc + vitest + `npx next build` before deploy; every contacts query `.is("archived_at", null)`; mutations call revalidatePath; contrast stone-700 light / stone-300 dark minimum; both themes checked; no em dashes in user-facing copy; API errors are `{ error }`; integration test for any new user-facing flow.
- Full persona-1 E2E report (matrix, all 13 bugs, evidence): transcript task output a9506d8de18602fe9; screenshots /tmp/e2e-free/.

## Prod status for reference

main (649d6fc) is live on savvo.app: batch-1 audit fixes (og:image, expired promo removed, Google-primary signup, embedding perf, npm audit) deployed and smoke-verified 2026-07-14. GEO score ~48/100; brand authority ~0 (zero third-party mentions) — that is what this distribution batch attacks.
