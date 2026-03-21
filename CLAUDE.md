# Savvo

AI-powered relationship manager. Keep every connection alive.

## Design Context

### Users
Startup founders, VCs, and professional networkers who meet many people weekly and struggle to maintain relationships at scale. They use the app in quick bursts — adding a contact after a meeting, checking who's going cold, glancing at the daily digest email. Speed and clarity matter more than feature density.

### Brand Personality
**Premium, Minimal, Confident.** Savvo should feel like a sharp, well-made tool — not a toy, not enterprise software. It's the kind of product that earns trust through restraint. Every element earns its place.

### Emotional Goal
**Delight and surprise.** Users should feel "this is way easier than I expected — it just works." The AI extraction, health scores, and daily digest should feel effortless, not complex. Moments of delight come from things working seamlessly, not from flashy animations.

### Aesthetic Direction
- **References:** Linear (precision, speed, polish), Clay (warm cards, modern CRM aesthetic, copper tones)
- **Anti-references:** Generic AI apps (dark mode, purple gradients, glowing neon), social media apps (feed-based, notification-heavy), spreadsheet/data tools (rows and columns, feels like work)
- **Theme:** Light mode primary. Warm stone palette with copper accent. Glass morphism cards. Serif headings (DM Serif Display) for personality, sans body (DM Sans) for clarity.
- **Color:** Sand background (#faf9f7), stone borders (#e7e5e4), copper accent (#c2410c → #ea580c gradient). Dark mode defined but secondary.

### Design Principles

1. **Earned minimalism.** Every element must justify its existence. If removing something doesn't hurt, remove it. But minimalism isn't emptiness — it's density of meaning.

2. **Warm precision.** Combine the warmth of the copper palette and serif typography with the precision of tight spacing, aligned grids, and consistent component patterns. Linear's discipline, Clay's warmth.

3. **Invisible intelligence.** The AI should feel like magic, not machinery. No loading spinners with "AI is thinking..." — just results appearing naturally. Health scores update silently. The digest email just shows up. The best technology is the kind you don't notice.

4. **Relationship-first hierarchy.** People's names, health status, and context always dominate the visual hierarchy. Metadata (dates, IDs, technical details) stays quiet. The interface should feel like looking at your network, not a database.

5. **Delight through speed.** Fast interactions are delightful interactions. Optimistic UI updates, instant navigation, staggered reveals that feel snappy not slow. The app should feel faster than the user expects.

## Quality Gates

Before shipping any feature:

1. **`npx tsc --noEmit`** — must pass (runs automatically via post-edit hook)
2. **`npx vitest run`** — all tests must pass
3. **Test with real-world inputs** — e.g. LinkedIn URLs from "Share Profile", not hand-typed clean URLs
4. **Check cross-feature conflicts** — if adding security headers, verify they don't break existing features (camera, iframes, etc.)
5. **Write an integration test** for any new user-facing flow in `src/__tests__/integration/`

Before deploying:

6. **`npx next build`** — must pass (catches SSR issues like missing Suspense boundaries)
7. **Run `.claude/hooks/post-deploy-smoke.sh`** after `vercel --prod` to verify the deploy

## Testing

- Run: `npx vitest run`
- Test directory: `src/__tests__/`
- Integration tests: `src/__tests__/integration/` — test real user flows with real-world inputs
- When fixing a bug, write a regression test that reproduces the bug first
- When adding a feature, write at least one integration test for the happy path
