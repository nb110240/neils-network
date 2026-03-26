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
- **Color:** Sand background (#faf9f7), stone borders (#e7e5e4), copper accent (#c2410c → #ea580c gradient). Dark mode is actively used — treat it as a first-class mode, not secondary.
- **Contrast rules (hard-learned):** Light mode body text: `stone-700` minimum, `stone-900` for headings. Dark mode body text: `stone-300` minimum, `stone-100` for headings. Card backgrounds: solid `white`/`stone-50` (light) or `stone-800`/`stone-900` (dark) — never use transparency that blends with the dotted sand background. Always verify both light and dark mode before shipping.
- **Dark mode implementation:** Tailwind v4 with class-based dark mode via `@custom-variant dark` in globals.css. ThemeSelector toggles `.dark` on `<html>`. CSS custom properties (`bg-background` etc.) AND Tailwind `dark:` utilities both respond to the `.dark` class. Dev server runs on **port 3001** (port 3000 is a different project).
- **No founder/about page.** The product speaks for itself. Do not create an /about page. Build E-E-A-T through content, social presence, and the product itself.

### Design Principles

1. **Earned minimalism.** Every element must justify its existence. If removing something doesn't hurt, remove it. But minimalism isn't emptiness — it's density of meaning.

2. **Warm precision.** Combine the warmth of the copper palette and serif typography with the precision of tight spacing, aligned grids, and consistent component patterns. Linear's discipline, Clay's warmth.

3. **Invisible intelligence.** The AI should feel like magic, not machinery. No loading spinners with "AI is thinking..." — just results appearing naturally. Health scores update silently. The digest email just shows up. The best technology is the kind you don't notice.

4. **Relationship-first hierarchy.** People's names, health status, and context always dominate the visual hierarchy. Metadata (dates, IDs, technical details) stays quiet. The interface should feel like looking at your network, not a database.

5. **Delight through speed.** Fast interactions are delightful interactions. Optimistic UI updates, instant navigation, staggered reveals that feel snappy not slow. The app should feel faster than the user expects.

6. **Purposeful motion.** Animations must earn their existence. Staggered card reveals (fast, subtle), typing demo on landing page (demonstrates the core "aha"), confetti on first contact (celebrates a milestone). No decorative animation. No loading spinners with "AI is thinking..." — results appear naturally.

## Quality Gates

Before shipping any feature:

1. **`npx tsc --noEmit`** — must pass (runs automatically via post-edit hook)
2. **`npx vitest run`** — all tests must pass
3. **Test with real-world inputs** — e.g. LinkedIn URLs from "Share Profile", not hand-typed clean URLs
4. **Check cross-feature conflicts** — if adding security headers, verify they don't break existing features (camera, iframes, etc.)
5. **Write an integration test** for any new user-facing flow in `src/__tests__/integration/`
6. **Verify all contact queries filter archived** — every `.from("contacts")` must include `.is("archived_at", null)` unless specifically querying archived contacts
7. **Verify mutations call revalidatePath** — any API route that changes contact data must call `revalidatePath("/dashboard")`, `revalidatePath("/reach-out")`, `revalidatePath("/contacts")`
8. **Check both light and dark mode** — contrast must meet the rules in Aesthetic Direction

Before deploying:

9. **`npx next build`** — must pass (catches SSR issues like missing Suspense boundaries)
10. **Run `.claude/hooks/post-deploy-smoke.sh`** after `vercel --prod` to verify the deploy

## Testing

- Run: `npx vitest run`
- Test directory: `src/__tests__/`
- Integration tests: `src/__tests__/integration/` — test real user flows with real-world inputs
- When fixing a bug, write a regression test that reproduces the bug first
- When adding a feature, write at least one integration test for the happy path
