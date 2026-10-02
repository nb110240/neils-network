# Savvo Google Play Store Metadata

Source of truth for the Play Console listing. Paste each field into the matching
Play Console input. Character limits are noted inline and counts are validated.
Facts mirror `ios/APP-STORE-METADATA.md`; claims were checked against the code
(paths cited where it matters).

App: Savvo (Capacitor Android wrapper, server.url -> https://savvo.app)
Package name: `app.savvo`
Positioning: AI-powered relationship manager for founders, VCs, and networkers.
Tagline: "Keep every connection alive."

> Style rule: no em dashes anywhere in this listing. Use commas, periods, or "and".
> Play policy: no ranking claims ("#1", "best"), no emoji or ALL CAPS gimmicks in
> the title, no calls to action like "Download now" in the title or short description.

---

## 1. App name (title)

30 characters max.

```
Savvo: Relationship Manager
```
Count: 27. Safe.

Fallback if needed: `Savvo: Personal CRM` (19).

---

## 2. Short description

80 characters max. Shown above the fold and indexed for search.

```
Track investors, keep promises, and know who to reach out to today.
```
Count: 67. Safe.

Alternate (networking-first):
```
Personal CRM that tells you who to reach out to today, before they go cold.
```
Count: 75.

---

## 3. Full description

4,000 characters max. Google Play indexes this text for search, so the key terms
(personal CRM, networking, investors, follow up, fundraising) appear naturally.

```
Savvo is the relationship manager for people whose network is their livelihood. Founders, investors, and operators rarely lose deals because their product is weak. They lose them because a relationship went quiet. Savvo makes sure that never happens.

KNOW YOUR NEXT MOVE
Open Savvo and see the few actions that matter most right now: a promise due today, a meeting to review, an investor who is drifting. Mark it done, snooze it, or open the contact. No feed, no noise.

RUN YOUR FUNDRAISE
Give every investor a raise stage, from researching and intro requested to partner meeting, diligence, and committed. See your whole pipeline at a glance and share a private raise snapshot with counts only, never names.

CAPTURE A MEETING IN SECONDS
Paste your notes after a call. Savvo finds the promises you made, the ones they made, and the next step, then waits in your review inbox for your approval. Nothing is applied or sent without you.

NEVER DROP A PROMISE
Commitments are tracked in both directions with due dates, so "I will send the deck by Thursday" turns into a reminder instead of a regret.

WARM INTROS
Plan intro requests through the people who know your targets, with a ready-to-edit draft message and a status for each request.

RELATIONSHIP HEALTH SCORES
Every contact gets a health score that reflects how warm or cold the relationship is, so you spend your time where it counts.

YOUR DIGEST
One short email with who to reach out to and why: daily on Pro, weekly on Free.

BUILT FOR THE WAY YOU WORK
- Add a contact by typing a sentence; Savvo fills in the details
- Scan a LinkedIn QR code to add someone you just met
- Import from CSV or Google Contacts, and sync Google Calendar (optional)
- Sign in with email or Google
- A calm, minimal interface in light and dark mode

SAVVO PRO
Pro unlocks unlimited contacts, unlimited semantic search, Google Contacts import, Google Calendar sync, and a daily digest. On Android, Pro is a subscription billed through Google Play and managed in the Play Store app. You can cancel any time.

PRIVATE BY DESIGN
Savvo does not scrape social networks, does not sell your data, and does not show ads. The people you add stay private to your account. You can export your data or delete your account and everything in it from Settings at any time.

Questions or feedback? Reach us at support@savvo.app.
```

Count: about 2,350 characters. Well under 4,000.

Verification notes for the claims above:
- Next moves, commitments, review inbox: `src/lib/next-moves.ts`, `src/app/(dashboard)/inbox`, `src/app/api/reviews`. AI proposals are only applied on approval (`/api/reviews/[id]/approve`).
- Raise stages and snapshot (counts only): `src/lib/investor-stage.ts`, `raise_snapshot_summary` in `supabase/migrations/20261001120000_growth_loops.sql`.
- Intro requests with draft message: `intro_requests` table, `src/app/(dashboard)/intros`.
- LinkedIn QR scan: `src/app/(dashboard)/scan/page.tsx` (needs the `CAMERA` permission in the manifest).
- Pro feature list: `features` in `src/app/pricing/page.tsx` (free plan: 50 contacts, weekly digest; Pro: unlimited, daily digest, Google Contacts import, Calendar sync).
- Export and delete: `src/app/api/settings/export`, `src/app/api/settings/delete-account`, privacy page "Delete Your Data".

---

## 4. Category and tags

- **App category:** Productivity
- **Tags** (Play Console -> Store settings -> Manage tags, pick up to 5): Productivity, Business, Contacts / CRM, Networking (pick the closest available labels).
- **Contact details:** email `support@savvo.app`, website `https://savvo.app`.
- **Privacy policy URL:** `https://savvo.app/privacy` (public, returns 200 logged out).

Note: `/support` is behind auth (`src/proxy.ts` protected paths), so do not use it
as the public website or support link.

---

## 5. Graphics

| Asset | File | Spec |
| --- | --- | --- |
| App icon | `store-assets/android/play-icon-512.png` | 512 x 512 PNG, full-bleed square (Play applies the mask) |
| Feature graphic | `store-assets/android/feature-graphic-1024x500.png` | 1024 x 500 PNG, no alpha |
| Phone screenshots | `store-assets/android/phone-*.png` | 1080 x 1920 (9:16), 2 to 8 images |

Upload order: next moves, contact with raise stage, capture, review inbox, intros,
raise snapshot, then the dark mode dashboard.

---

## 6. App access (reviewer login)

Choose "All or some functionality is restricted" and provide a working demo
account (email + password) with sample data. Instructions: "Sign in with the
email and password below on the login screen. Google sign-in is not required."
Use a dedicated reviewer account, never a real user's.

---

## 7. Ads

Contains ads: **No**. (No ad SDKs anywhere in `package.json`.)

---

## 8. Content rating (IARC questionnaire)

Category: **Utility, Productivity, Communication, or Other**.

| Question | Answer |
| --- | --- |
| Violence, blood, gore | No |
| Sexuality, nudity | No |
| Profanity or crude humor | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling (real or simulated) | No |
| Users can interact or exchange content with each other | No. Contacts are private to the account. The raise snapshot is a one-way, counts-only read link with no names, messaging, or user content. |
| Shares the user's current physical location with other users | No |
| Allows users to purchase digital goods | Yes (Pro subscription via Google Play Billing) |
| Unrestricted internet access (web browser or search engine) | No. The WebView is locked to savvo.app. |
| Is this a news app | No |

Expected rating: **Everyone / PEGI 3 / USK 0**, with an "In-App Purchases" notice.

## 9. Target audience and content

- Target age groups: **18 and over** only.
- Appeals to children: No.
- Not designed for families; do not opt in to Designed for Families.

## 10. Other declarations

- Government app: No. Financial features: No (it tracks fundraising conversations, it does not move money or give financial advice). Health app: No. News app: No.
- Advertising ID: the app does **not** use the Android Advertising ID. Answer "No".
  If the merged manifest from a dependency ever adds `com.google.android.gms.permission.AD_ID`,
  remove it with `tools:node="remove"` and keep the answer No.

---

## 11. Data safety form

Answers reflect the code as of this branch. Re-check before every release that
adds an SDK or a data field.

**Overview questions**

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes (HTTPS only; `cleartext: false`, HSTS) |
| Do you provide a way for users to request that their data is deleted? | Yes. In-app: Settings -> Danger Zone -> Delete Account. Web link for the form: `https://savvo.app/privacy` (section "Delete Your Data") or a dedicated public page if you add one. |

**Sharing:** Savvo does not share user data with third parties as Google defines
"sharing". Data sent to service providers that process it on Savvo's behalf
(Supabase hosting, OpenAI for extraction and embeddings, Sentry, PostHog,
Stripe, Resend for email, RevenueCat and Google Play for billing) is a transfer
to a service provider, which Play excludes from "shared". So **Shared = No** for
every row below.

**Data types collected** (all: Collected = Yes, Shared = No, Processed
ephemerally = No unless noted)

| Play data type | Required or optional | Purposes | Source in code |
| --- | --- | --- | --- |
| Personal info > Name | Optional | App functionality, Account management | User's own name (profile metadata) |
| Personal info > Email address | Required | App functionality, Account management, Developer communications | Supabase auth email; daily digest via Resend |
| Personal info > User IDs | Required | App functionality, Analytics, Account management | Supabase user id; PostHog identify; RevenueCat appUserID |
| Personal info > Other info | Optional | App functionality | Fields the user enters about themselves, for example networking goal (personalization) |
| Financial info > Purchase history | Optional | App functionality | Pro subscription status (`subscriptions` table) from Stripe on web and RevenueCat/Google Play in app. Card data stays with Stripe/Google and is not collected. |
| Contacts | Required | App functionality | The people the user adds: names, emails, phone numbers, companies, notes, interaction history and recency (`contacts`, `contact_activities`). Google Contacts import is optional and read-only. The device address book is **not** read. |
| Calendar > Calendar events | Optional | App functionality | Google Calendar sync (read-only scope `calendar.readonly`), only when the user connects it |
| App activity > App interactions | Required | Analytics | PostHog product events; Sentry session replay (10 percent of sessions, 100 percent on error) |
| App activity > Other user-generated content | Required | App functionality | Meeting notes, after-call reviews, commitments, intro requests, tags |
| App info and performance > Crash logs | Required | Analytics, App functionality | Sentry |
| App info and performance > Diagnostics | Required | Analytics, App functionality | Sentry performance traces and error context |
| Device or other IDs | Optional | App functionality | FCM push token, once push registration ships. Declare it in the release that turns on push. |

**Not collected:** precise or approximate location, SMS or call logs, photos and
videos (QR frames are decoded on device and never uploaded), audio, files and
docs, health and fitness, web browsing history, in-app search history (search
queries are processed per request and not stored), installed apps, Advertising ID.

Security practices to tick: data encrypted in transit; users can request deletion.
Do not tick the independent security review badge unless you complete a MASA review.

---

## 12. Release notes (first release)

500 characters max.

```
Welcome to Savvo on Android. Track your fundraise by investor stage, capture meetings in seconds, keep every promise, and get a clear list of who to reach out to today.
```
Count: 168.

---

## 13. Pre-submit checklist

- [ ] Title <= 30 (27), short description <= 80 (67), full description <= 4000 (about 2,350).
- [ ] No em dashes in any listing text.
- [ ] Privacy policy URL returns 200 logged out.
- [ ] App access demo account works on a clean install.
- [ ] Content rating questionnaire submitted (expected Everyone).
- [ ] Target audience 18+.
- [ ] Data safety form matches Section 11; push token row added when push ships.
- [ ] Account deletion URL entered.
- [ ] Icon 512, feature graphic 1024 x 500, at least 2 phone screenshots uploaded.
- [ ] Subscription products active and attached in RevenueCat (see `DEPLOY-ANDROID.md` step 10).
