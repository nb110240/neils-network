# Savvo App Store Metadata

Source of truth for the App Store Connect listing. Paste each field into the matching
App Store Connect input. Character limits are noted inline; counts are validated below.

App: Savvo (Capacitor iOS wrapper, server.url -> https://savvo.app)
Bundle ID: app.savvo
Positioning: AI-powered relationship manager for founders, VCs, and networkers.
Tagline: "Keep every connection alive."
Aesthetic note for screenshots: premium, minimal, warm copper.

> Style rule: no em dashes anywhere in this listing. Use commas, periods, or "and".

---

## 1. App Name and Subtitle

App Store Connect enforces a 30-character max on each.

**App Name** (30 char max)
```
Savvo: Relationship Manager
```
Count: 27. Safe.

**Subtitle** (30 char max)
```
Keep every connection alive
```
Count: 27. Safe.

Alternate name option if the primary is taken (keyword-forward, 30 chars or fewer):
```
Savvo: Personal CRM
```
Count: 19.

Alternate subtitle (more intent keywords, 30 chars or fewer):
```
Personal CRM for networking
```
Count: 27.

---

## 2. Promotional Text

Up to 170 characters. Editable any time without a new build, so use it for the current hook.

```
Your network is your net worth. Savvo tracks every relationship, scores its health, and tells you exactly who to reach out to today. Never let a warm intro go cold.
```
Count: 164. Safe.

---

## 3. Description

Up to 4,000 characters. Keywords here do not affect ranking on the App Store, so this is
written for the human reader (conversion), not for the algorithm.

```
Savvo is the relationship manager for people whose network is their livelihood. Founders, investors, and operators do not lose deals because their product is weak. They lose them because a relationship went quiet. Savvo makes sure that never happens.

KEEP EVERY CONNECTION ALIVE
Add the people who matter, from co-founders and investors to customers and old colleagues. Savvo keeps each relationship in one calm, private place so nothing slips through the cracks.

RELATIONSHIP HEALTH SCORES
Every contact gets a health score that reflects how warm or cold the relationship is. At a glance you see which connections are thriving and which ones are fading, so you spend your time where it counts.

YOUR DAILY DIGEST
Each morning Savvo sends one short email: who to reach out to today and why. No endless feed, no notification overload. Just a focused nudge that turns good intentions into real follow-ups.

AI THAT WORKS FOR YOU
Savvo uses AI to surface the right person at the right moment and to help you remember the context that makes outreach feel personal. You stay in control. Your contacts are yours.

BUILT FOR THE WAY YOU ACTUALLY WORK
- Add notes, context, and reminders to any contact
- See your whole network ranked by relationship health
- Get a single daily digest instead of a noisy inbox
- Sign in with email or Google in seconds
- A premium, minimal interface that respects your attention

SAVVO PRO
Upgrade to Pro for power users who manage large networks. Pro unlocks deeper relationship tools and higher limits. Subscriptions are billed through your Apple ID and managed in your account.

PRIVATE BY DESIGN
Savvo does not scrape social networks and does not share your contacts. The people you add stay private to you. We collect only what is needed to run the product, and we tell you exactly what that is.

Stop letting relationships go cold. Start every day knowing exactly who to reach out to. Download Savvo and keep every connection alive.

Questions or feedback? Reach us at neil@savvo.app.
```
Count: approximately 1,830 characters. Well under 4,000.

---

## 4. Keywords

One field, 100 characters max, comma-separated, no spaces after commas (a space costs a
character, so omit them to fit more terms). Do not repeat words already in the App Name or
Subtitle (Savvo, relationship, manager, connection), since Apple already indexes those.
Singular and plural are treated similarly, so prefer one form. Do not repeat the category
name; it is indexed automatically.

Researched for relationship, CRM, and networking search intent (competitors index on:
personal CRM, networking, contacts, follow up, reminders, rolodex, VC, founder).

```
personal crm,networking,contacts,follow up,reminder,rolodex,founder,investor,vc,intro,outreach
```
Count: 94. Safe (6 chars headroom).

Keyword rationale:
- personal crm: highest-intent head term for this category (Dex, Clay, Monica all target it).
- networking: core use case and high-volume.
- contacts, rolodex: classic discovery terms for address-book replacements.
- follow up, reminder, outreach, intro: the job-to-be-done (stay in touch, do the outreach).
- founder, investor, vc: the ICP; these are also app-name keywords competitors use.

Spare terms (swap in if you drop something, staying under 100): network, relationships,
connect, sales. "relationship" and "manager" are intentionally omitted because they are
already in the App Name and Subtitle, which Apple indexes automatically. Adding either to the
keyword field wastes characters.

---

## 5. Category

- **Primary category:** Productivity
- **Secondary category:** Business

Rationale: the daily-digest, contacts, and follow-up workflow is a productivity habit first.
Business is the natural secondary given the founder, VC, and sales ICP and the Pro tier.
Personal CRM competitors typically sit in Productivity or Business, so this matches search
context on the store.

---

## 6. Age Rating Inputs

Answer the App Store Connect age-rating questionnaire as follows. All frequency questions
are "None" unless noted. Expected resulting rating: **4+**.

| Questionnaire item | Answer |
| --- | --- |
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| Sexual Content or Nudity | None |
| Graphic Sexual Content and Nudity | None |
| Contests | None |
| Unrestricted Web Access | No (the WebView loads only savvo.app; not a general browser) |
| Gambling and Contests | No |
| Made for Kids | No |
| Age Verification / age-gated content | No |

Notes:
- "Unrestricted Web Access" is No because the Capacitor server.url WebView is locked to the
  savvo.app origin and does not function as an open browser.
- No user-generated content is shared between users (contacts are private to the account),
  so the UGC moderation questions do not apply.
- Expected final rating: 4+.

---

## 7. Support and Marketing URLs

| Field | Value |
| --- | --- |
| Support URL (required) | https://savvo.app/help |
| Marketing URL (optional) | https://savvo.app |
| Privacy Policy URL (required) | https://savvo.app/privacy |
| Support email (App Review contact) | neil@savvo.app |
| Copyright | 2026 Savvo |

https://savvo.app/help is public (returns 200 to a logged-out visitor) and covers sign-in,
subscriptions on every store, data export and account deletion. https://savvo.app/support
also works: logged-out visitors are redirected to /help, signed-in users get the in-app
contact form. Before submission, confirm /help and /privacy both load in a private window.
The email matches the one on the privacy policy and help page; if you set up a dedicated
support@savvo.app inbox later, change it in all three places.

---

## 8. App Privacy "Nutrition Label" Mapping

This maps exactly what Savvo collects to Apple's App Privacy data-type categories, with the
"Linked to the user" and "Used to track you" flags for each. Fill this into App Store Connect
under App Privacy.

Definitions used (Apple):
- "Collect" = transmitted off device and retained beyond serving the real-time request.
- "Linked to you" = associated with the user's identity (account, device, etc.).
- "Used to track you" = linked with data from other companies' apps/sites for targeted ads or
  ad measurement, or shared with data brokers. Savvo does NONE of this, so Tracking = No for
  every data type below. Savvo does not use IDFA and should not present the App Tracking
  Transparency prompt.

Top-level answer to "Do you or your third-party partners collect data from this app?": **Yes.**

### Data types collected

| Apple data type | Collected? | Purpose(s) | Linked to user? | Used to track? | Source / why |
| --- | --- | --- | --- | --- | --- |
| Contact Info > Email Address | Yes | App Functionality | Yes | No | The account email from Supabase auth (email or Google sign-in); used for login and the daily digest. |
| Contact Info > Name | Yes | App Functionality | Yes | No | The user's own name if provided at sign-up, and names of contacts the user enters (see Other User Content below for the broader contact data). |
| User Content > Other User Content | Yes | App Functionality | Yes | No | The contacts the user manually enters (names, notes, context, reminders) and relationship data they create. User-generated, stored to provide the core product. |
| Identifiers > User ID | Yes | App Functionality, Analytics | Yes | No | Supabase account/user ID; also the distinct ID associated with PostHog analytics events. |
| Usage Data > Product Interaction | Yes | Analytics, Product Personalization | Yes | No | PostHog: screen views, taps, feature usage to improve the product. |
| Diagnostics > Crash Data | Yes | App Functionality (stability) | Yes | No | Sentry: crash and error reports. Linked because tied to the authenticated session/user. |
| Diagnostics > Performance Data | Yes | App Functionality | Yes | No | Sentry: performance and latency traces. |
| Diagnostics > Other Diagnostic Data | Yes | App Functionality | Yes | No | Sentry: error context (stack traces, breadcrumbs). |
| Purchases > Purchase History | Yes | App Functionality | Yes | No | Stripe: Pro subscription status and billing records tied to the account. |

### Data types NOT collected (do not declare unless these change)

- Financial Info > Payment Info (card number, etc.): NOT collected by Savvo. Stripe processes
  and stores card data on Stripe's side; Savvo never receives or stores the card number. Only
  the resulting purchase/subscription status is associated with the account (declared above as
  Purchase History). If you later store card brand or last4 in your own DB, add
  Financial Info > Payment Info.
- Location (precise or coarse): NOT collected.
- Contacts (Apple "Contacts" data type): the iOS system address book / Contact Picker is NOT
  read. BUT the app offers a Google Contacts import (src/app/api/import/google/route.ts requests
  contacts.readonly and stores imported names/emails/phones), which pulls third-party contact
  data. Apple's "Contacts" data type covers contacts from a user's address book or social graph,
  so if the Google import ships in the iOS build you should declare the Apple "Contacts" data
  type as collected + linked (in addition to User Content > Other User Content). If you suppress
  the Google import in native, the device address book remains untouched and Contacts stays
  not-collected. Decide this before filling the questionnaire. (A native iOS address-book import
  would additionally require an NSContactsUsageDescription.)
- Health, Browsing History, Search History, Sensitive Info, Audio Data, Photos/Videos,
  Gameplay Content, Customer Support free-text beyond email: NOT collected.

### Tracking summary
- Used to Track You: NONE. No third-party advertising SDKs, no IDFA, no data-broker sharing.
- App Tracking Transparency prompt: not required and should not be shown.

### Per-vendor crosswalk (internal reference, not entered into App Store Connect)
- Supabase (auth + DB): Email Address, Name, User ID, Other User Content. Linked. No tracking.
- PostHog (product analytics): Product Interaction, User ID. Linked. No tracking (events are
  first-party, not shared for cross-app ad targeting).
- Sentry (crash/error): Crash Data, Performance Data, Other Diagnostic Data. Linked. No tracking.
- Stripe (payments): Purchase History (status). Card data stays with Stripe, not declared by
  Savvo. No tracking.

Action item: ensure each third-party SDK ships a valid privacy manifest (PrivacyInfo.xcprivacy)
and that the signatures/manifests requirement is satisfied at upload. The Capacitor plugins,
PostHog, Sentry, and Stripe SDKs each need their manifest present.

---

## 9. Screenshot Spec

Apple requires uploads for the largest iPhone display; smaller sizes are auto-scaled but a
dedicated set looks better. Provide an iPad set only if the app supports iPad (decide before
submit). Max 10 screenshots per device size; we ship 5.

### Required / recommended sizes (portrait, pixels)

| Device class | Display | Portrait resolution | Required? |
| --- | --- | --- | --- |
| iPhone 6.9" | 16 Pro Max / 15 Pro Max class | 1320 x 2868 | Required (largest iPhone) |
| iPhone 6.5" | older Plus/Max class | 1242 x 2688 | Recommended for older devices |
| iPad 13" | iPad Pro 13" | 2064 x 2752 | Required only if app supports iPad |

Minimum viable upload: the 6.9" iPhone set. Add 6.5" and the 13" iPad set if/when iPad is in scope.

### Frame requirements
- File format: PNG or JPEG, RGB, flattened, no alpha/transparency.
- No status-bar clutter or device chrome that misrepresents the UI.
- Each frame should read in under 2 seconds. Keep copy short and high-contrast on the copper
  palette (dark copper text on light, or light text on deep copper).
- First two frames carry the conversion; they show before the user taps "more". Lead with value.

### Suggested 5 frames (warm copper, premium, minimal)

1. Hero + value prop
   - Headline: "Keep every connection alive."
   - Visual: the dashboard with contacts ranked by health score. Sets the promise immediately.
2. Relationship health scores
   - Headline: "See which relationships are going cold."
   - Visual: a contact list with warm-to-cold health indicators in copper tones.
3. Daily digest
   - Headline: "One email a day. Exactly who to reach out to."
   - Visual: the morning digest, clean and minimal, one focused list.
4. Contact detail + notes
   - Headline: "Remember the context that makes outreach personal."
   - Visual: a single contact with notes, last touch, and a reminder.
5. Built for founders, VCs, and networkers (+ Pro)
   - Headline: "Your network is your net worth."
   - Visual: subtle Pro upgrade cue, premium copper finish, social proof line if available.

App preview video (optional): 15 to 30 seconds, same resolutions as the screenshots, showing
the add-contact to daily-digest loop. Not required for launch.

---

## 10. Pre-submit checklist
- [ ] App Name and Subtitle each <= 30 chars (verified: 27 / 27).
- [ ] Promotional text <= 170 chars (verified: 164).
- [ ] Keyword field <= 100 chars, no leading category/name dupes (verified: 94).
- [ ] Description has no em dashes.
- [ ] Support URL and Privacy Policy URL both return 200.
- [ ] App Privacy answers entered to match Section 8; Tracking = No for all.
- [ ] Every bundled SDK has a privacy manifest at upload.
- [ ] 6.9" iPhone screenshots uploaded (5 frames), iPad set added only if iPad is supported.
- [ ] Age rating questionnaire completed per Section 6 (expected 4+).
- [ ] Stripe subscription disclosed as an in-app purchase / external billing per current App
      Review rules; confirm the Pro purchase flow complies before submitting.

---

Sources consulted for category names and privacy definitions:
Apple, App Privacy Details (https://developer.apple.com/app-store/app-privacy-details/);
Apple, Privacy Definitions and Examples (https://apps.apple.com/us/story/id1539235847);
App Store Connect Help, Manage app privacy
(https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).
