# Savvo Distribution Playbook

**Product:** Savvo (savvo.app), the investor CRM for founders raising a round
**Founder:** Neil Bajaj (@neilbajaj on X, neil@savvo.app)
**Positioning:** "The investor CRM for founders raising a round" / "Run your raise without a spreadsheet"
**Pricing:** Free (50 contacts) | Pro $8/mo or $75/yr
**Why this playbook exists:** Web searches for "Savvo" return only savvo.app itself. Zero Product Hunt, Reddit, or directory presence means AI search engines (ChatGPT, Perplexity, Google AI Overviews) have no third-party sources to cite. Every section below creates a citable, crawlable mention of Savvo somewhere other than savvo.app.

**Rules for all copy in this file:**
- Everything is copy-paste ready. No placeholders except where marked `[...]`.
- No fabricated metrics, user counts, revenue claims, or testimonials.
- Build-in-public voice: honest, specific, first person.

---

## 1. Product Hunt Launch Pack

### Name

**Savvo**

### Tagline options (60 char max)

1. `The investor CRM for founders raising a round` (45 chars) **← recommended, matches homepage positioning exactly**
2. `Run your raise without a spreadsheet` (36 chars)
3. `Type what you remember. AI tracks your raise.` (45 chars)

### Description (~260 chars)

> Savvo is the investor CRM for founders raising a round. Type what you remember after each pitch and AI turns it into structured contacts. Health scores show which investors are going cold, and a daily digest tells you who to follow up with. Free for 50 contacts.

(262 characters)

### Topics / categories

Pick 3 (PH allows up to 3): **SaaS**, **Productivity**, **Artificial Intelligence**.
If a CRM or Sales topic is offered in the picker, swap it in for Productivity. Avoid "Investing" (that topic is about investing apps for retail investors, not fundraising tools).

### First comment from the maker (post immediately at launch)

> Hey Product Hunt, Neil here. I'm the founder, and by founder I mean the entire team.
>
> Savvo started because my own fundraise tracking fell apart. I was meeting investors every week and logging everything in a spreadsheet: name, firm, status, last contact. It worked until it didn't. Warm conversations went cold because nothing reminded me to follow up, and I kept walking into second meetings unable to remember what we discussed in the first one. A spreadsheet tracks data. It does not track relationships.
>
> So I built the tool I wanted, in public, with the changelog open at savvo.app/changelog. The core loop shipped in March: type a note the way you'd text a friend ("Met Sarah Chen at Founders Dinner, partner at Sequoia, wants Q2 metrics") and AI extracts the name, firm, role, how you met, and the next step. No forms. Since then I've shipped health scores that show which investor relationships are going cold, a daily digest email that tells you who needs attention each morning, semantic search ("who do I know in healthcare AI?"), follow-up cadences and snooze, CSV and Google Contacts import with automatic dedupe, Google Calendar sync, AI follow-up drafts, and one-click export of everything Savvo stores about you as JSON.
>
> Honest current state: Savvo is young and I'm the only person behind it. It's live, the core workflow is working, and there are rough edges I know about and probably some I don't. The free plan covers 50 contacts with health scores and a weekly digest, no credit card. Pro is $8/mo or $75/yr for unlimited contacts, unlimited search, imports, calendar sync, and the daily digest. Your contact data is never sold or shown to other users. AI providers process data for the features you choose, and OpenAI API inputs and outputs are not used to train OpenAI models by default. You can export or delete everything at any time.
>
> What I'd genuinely love from you today:
>
> 1. If you're mid-raise or about to start one, tell me what your current tracking setup looks like and where it breaks. That's the exact problem I'm building against.
> 2. Try the natural language input with a real note from a real meeting, messy grammar and all, and tell me what the AI got wrong.
> 3. Roast the pricing. Is $8/mo right for a solo-founder tool like this?
>
> I'll be here all day answering everything. Thanks for looking.

(~370 words)

### Gallery checklist

The og image already exists and is generated at **https://savvo.app/opengraph-image** (source: `src/app/opengraph-image.tsx`). Reuse its visual language for the gallery so the launch assets match what gets shared on social.

| # | Asset | Screen to capture | Format / size | Notes |
|---|---|---|---|---|
| 1 | Thumbnail | Savvo logomark on sand background (#faf9f7) with copper accent | 240x240 PNG, or animated GIF under 3MB | A subtle GIF thumbnail (logo + one line of the typing demo) stands out in the feed |
| 2 | Hero GIF (first gallery slot) | The homepage typing demo: freeform note being typed, then the structured contact card appearing (the core "aha") | 1270x760 GIF, under 3MB, 10 to 15 seconds, loop | This is the single most important asset. Record at 2x and downscale for crispness |
| 3 | Screenshot 2 | `/dashboard` showing health scores (green/yellow/orange/red badges) across real-looking contacts | 1270x760 PNG | Use demo data, not real investor names |
| 4 | Screenshot 3 | `/reach-out` list: "who needs attention today," sorted by urgency, with cadence-due contacts on top | 1270x760 PNG | Caption overlay: "Your daily follow-up list" |
| 5 | Screenshot 4 | `/graph` network graph view | 1270x760 PNG | Visually distinctive, earns a swipe |
| 6 | Optional screenshot 5 | The daily digest email in an inbox | 1270x760 PNG | Shows the retention loop, screenshots of email feel concrete |

All gallery images: 1270x760 (PH's recommended size), PNG for stills, GIF only where motion explains the feature, everything under 3MB. Two gallery images minimum are required; aim for 5.

### Launch-day runbook

**When to launch (verified against current PH conventions, July 2026):**
- Launch at **12:01 AM Pacific** so you get the full 24-hour window.
- **Tuesday, Wednesday, or Thursday** for maximum traffic; weekends have less traffic but a much easier leaderboard. For a solo founder with a small network, a Tuesday or Wednesday is still the right call: the goal here is citable presence and referral traffic, not winning the day.
- The 2026 ranking algorithm rewards **sustained upvote velocity across a ~20-hour window**, not a first-two-hours spike. Do not front-load everything; spread your outreach across the day (morning US, midday US, evening US/morning Europe).

**The 5 things to do in the first hour:**
1. Post the maker first comment (above) the minute the launch goes live.
2. Post a single tweet from @neilbajaj: launch link, the hero GIF, one sentence of story. Pin it.
3. Send the pre-drafted email to your users (template below) and drop the same message in any Slack/Discord communities where you're already an active member (share as "I launched today," not a vote request).
4. Add the launch link to your X bio and the savvo.app changelog for the day.
5. Set up camp: reply to every PH comment within 15 minutes for the first six hours. Comment replies drive ranking and are the best source of feedback you'll get all year.

**How to ask your users for support (verified against PH community guidelines, July 2026):**
PH explicitly prohibits asking for upvotes, mass-messaging for votes, incentivized votes, and coordinated voting. Launches get unfeatured for it. What is allowed and encouraged: asking people to **check out the launch and leave honest feedback**. So the ask is feedback, never votes:

> Subject: Savvo is on Product Hunt today
>
> Hey [first name],
>
> Quick one. Savvo is live on Product Hunt today: [launch URL]
>
> You've actually used the product, which makes your opinion more useful than almost anyone's there. If you have two minutes, I'd love it if you left a comment with your honest take: what's working for you, what's missing, what you'd tell another founder considering it.
>
> No pressure either way, and thanks for being an early user.
>
> Neil

Note what this does not say: it never mentions upvoting. Users who visit and comment will vote on their own if they want to, and comments are worth more than votes anyway.

**Before launch day (1 to 2 weeks out):**
- Create the PH product page early ("Coming soon" state) so the URL exists and followers can be notified.
- Warm up your PH account: follow topics, upvote and comment genuinely for a couple of weeks. Brand-new silent accounts get less distribution.
- Prepare all gallery assets and copy in a doc so launch night is paste-only.
- Line up your ~20 users with a heads-up email two days before: "I'm launching on PH Tuesday, would love your honest feedback there."

---

## 2. Directory Submission Pack

All ten targets verified via web search in July 2026. Status, cost, and submission URL per directory, in priority order. Budget guidance for a solo founder: do all the free ones first (SaaSHub, AlternativeTo, Toolify free queue, Uneed free queue, MicroLaunch, Indie Hackers, Startup Stash), consider the two cheap paid skips (Uneed $29.99, Toolify $99) only if the free queues are slow, and skip the expensive ones (TAAFT $347, Futurepedia $497) until Savvo has revenue to justify them.

### 2.1 SaaSHub: VERIFIED LIVE, FREE

- **Submit at:** https://www.saashub.com/services/submit
- **Cost:** Free (do-follow backlink, DR ~74). Optional paid highlight, not needed.
- **Process:** Paste https://savvo.app, fill the form, list competitors (submissions without competitors listed get deprioritized), verify the product for faster approval. Approval in 1 to 2 days.

**Copy:**
- Name: `Savvo`
- Tagline: `The investor CRM for founders raising a round`
- Description:
  > Savvo helps founders run a fundraise without a spreadsheet. Type what you remember after each investor meeting and AI extracts the name, firm, role, and next steps into a structured contact. Health scores show which investor relationships are going cold, a daily digest email tells you who to follow up with each morning, and semantic search finds people by context ("who do I know in healthcare AI?"). Includes CSV and Google Contacts import with dedupe, Google Calendar sync, AI follow-up drafts, and follow-up cadences. Free for 50 contacts, Pro at $8/mo.
- Categories: CRM, Sales Tools, Productivity, AI Tools
- Competitors to list: Airtable, Attio, Streak, Dex, Clay, folk, Notion

### 2.2 AlternativeTo: VERIFIED LIVE, FREE

- **Submit at:** https://alternativeto.net (log in, click the user icon top right, choose "Suggest new application")
- **Cost:** Free.
- **Gotcha:** New accounts must be **at least one week old** before they can submit an app. Create the account on day 1 of week 1 so you can submit in week 2. Approval usually within 1 to 2 days after that.
- **Format:** AlternativeTo is built around "alternative to X" claims. Be generous with alternatives and tags; that's what drives internal visibility.

**Copy:**
- Name: `Savvo`
- Short description:
  > Investor CRM for founders raising a round. Type freeform notes after each pitch and AI extracts structured contacts. Health scores show which investors are going cold, and a daily digest email surfaces who to follow up with. Free for 50 contacts, Pro $8/mo.
- Claim as an alternative to: **Airtable, Streak, Attio, Notion, Dex, Clay, folk**
- Suggested alternative blurb (used when your listing appears on those pages):
  > Unlike spreadsheet-style tools, Savvo has no forms and no columns to maintain. You type what you remember and AI structures it, then health scores and a daily digest handle the follow-up.
- Platforms: Web, self-hostable: No, PWA installable
- Tags: crm, fundraising, investor-relations, personal-crm, contact-management, ai, founders, startup-tools
- License: Proprietary, Freemium

### 2.3 There's An AI For That (TAAFT): VERIFIED LIVE, PAID ($347)

- **Submit at:** https://theresanaiforthat.com/get-featured/ (pricing at https://theresanaiforthat.com/s/pricing/)
- **Cost:** $347 one-time for a permanent listing (1 to 2 day processing). **Free path:** TAAFT runs a monthly thread on X where indie makers submit their tool and one gets listed free. Follow @theresanaiforthat on X and enter that thread every month; it costs nothing.
- **Recommendation:** Do the free X thread now, defer the $347 until directory ROI is proven elsewhere.

**Copy (works for either path):**
- Name: `Savvo`
- Task/use case (TAAFT organizes by task): `Investor pipeline tracking` / `Fundraising CRM`
- Description:
  > Savvo is an AI investor CRM for founders raising a round. After each pitch, type what you remember in plain language and AI extracts the investor's name, firm, role, and next steps. Relationship health scores flag which investors are going cold, semantic search finds contacts by meaning, and a daily digest email lists who needs a follow-up. Free for 50 contacts.

### 2.4 Toolify: VERIFIED LIVE, FREE (slow queue) or $99 expedited

- **Submit at:** https://www.toolify.ai/submit
- **Cost:** Free queue takes roughly 2 to 4 weeks; $99 gets you listed within 48 hours. Paid placement does not change organic ranking, so the free queue loses nothing except time.
- **Recommendation:** Submit free in week 1 so the queue clock starts. Fill the profile completely (screenshots, long description); complete profiles rank better in Toolify's category pages.

**Copy:**
- Name: `Savvo`
- Tagline: `AI investor CRM for founders raising a round`
- Description:
  > Savvo turns messy post-meeting notes into a structured investor pipeline. Type what you remember ("Met Sarah Chen at Founders Dinner, partner at Sequoia, wants Q2 metrics") and AI extracts the contact, firm, and next steps. Every investor gets a color-coded health score based on when you last talked, a daily digest email surfaces who needs attention, and semantic search answers questions like "who do I know in fintech?". Also includes AI follow-up drafts, follow-up cadences, CSV and Google Contacts import with dedupe, and Google Calendar sync. Free plan covers 50 contacts; Pro is $8/mo or $75/yr.
- Categories: AI CRM Assistant, AI Productivity Tools, Sales Assistant

### 2.5 BetaList: VERIFIED LIVE, PAID (~$39 standard, ~$99-129 expedited)

- **Submit at:** https://betalist.com/submit (criteria: https://betalist.com/criteria)
- **Cost:** No free queue anymore as of 2026; standard submission around $39, expedited review options above that. Pricing has shifted recently, so confirm on the submit page before paying.
- **Fit warning (from their published criteria):** BetaList wants startups that are "recently launched or still unreleased" and says products launched weeks ago are less suitable. Savvo has been live since March 2026. **Frame the submission around what is new**: pitch it as the launch of the investor-CRM positioning and the current feature set, not the original release. If they decline, no loss; deprioritize this one below the free directories.

**Copy:**
- Name: `Savvo`
- Pitch (BetaList style, one crisp line): `Run your fundraise without a spreadsheet`
- Description:
  > Savvo is an investor CRM built for founders who are actively raising. Instead of maintaining a spreadsheet, you type what you remember after each pitch and AI structures the investor, firm, role, intro path, and next step. Health scores show which relationships are going cold, and a daily digest email tells you exactly who to follow up with today. Built solo, in public, by @neilbajaj. Free for 50 contacts.

### 2.6 Uneed: VERIFIED LIVE, FREE (queue) or $29.99 to pick your date

- **Submit at:** https://www.uneed.best/submit-a-tool (launch guide: https://www.uneed.best/launch-guide)
- **Cost:** Free via the waiting line (launch date auto-assigned); $29.99 to skip the line and choose your day. 20 to 30 products launch daily at 12:00 AM PST; listings are permanent, with Product of the Day/Week/Month leaderboards.
- **Recommendation:** Submit free in week 1. If the assigned date collides with your PH launch week, pay the $29.99 to move it; a Uneed launch one week after PH gives you a second spike.

**Copy:**
- Name: `Savvo`
- Tagline: `The investor CRM for founders raising a round`
- Description:
  > Met 12 investors this week? Type what you remember after every pitch and Savvo's AI turns it into a structured contact and follow-up record. Health scores show which relationships are going cold, and a daily digest email tells you who to reach out to each morning. Semantic search, AI follow-up drafts, calendar sync, and spreadsheet import included. Free for 50 contacts, Pro $8/mo.

### 2.7 MicroLaunch: VERIFIED LIVE, FREE (premium optional)

- **Submit at:** https://microlaunch.net (click "New Launch" after signing up)
- **Cost:** Free launches; optional Premium at https://microlaunch.net/premium for extra visibility. Products launch over a month-long window, so timing pressure is low.

**Copy:**
- Name: `Savvo`
- Tagline: `Run your raise without a spreadsheet`
- Description:
  > Solo-built investor CRM for founders raising a round. The core idea: you should never fill out a form after an investor meeting. Type what you remember, in whatever order you remember it, and AI extracts the contact, firm, and next steps. Health scores and a daily digest email keep every investor relationship warm through the raise, and semantic search means you can ask your own network questions like "who do I know in healthcare AI?". Built in public by @neilbajaj, changelog at savvo.app/changelog. Free for 50 contacts.

### 2.8 Indie Hackers product page: LIVE (product directory confirmed at indiehackers.com/products), FREE

- **Submit at:** https://www.indiehackers.com/products (sign in, then add a product from your account; the add-product flow requires an IH account, and the exact button placement changes with their redesigns, so look under your profile or the products page header)
- **Cost:** Free.
- **Note:** IH product pages double as build-in-public timelines. Post milestones there (PH launch, feature ships) as updates; each update is another indexed page mentioning Savvo.

**Copy:**
- Name: `Savvo`
- Tagline: `The investor CRM for founders raising a round`
- Description:
  > Savvo replaces the fundraising spreadsheet. After each investor meeting you type what you remember and AI extracts the structured contact: name, firm, role, next step. Health scores show which investors are going cold, a daily digest email surfaces who needs a follow-up, and semantic search finds people by context. Solo-built in public; the full changelog is at savvo.app/changelog. Free for 50 contacts, Pro $8/mo or $75/yr.
- Revenue/metrics fields: leave blank or private. Do not invent numbers.

### 2.9 Futurepedia: VERIFIED LIVE, PAID ONLY ($497 verified listing)

- **Submit at:** https://www.futurepedia.io/submit-tool
- **Cost:** $497 one-time for a verified listing (refunded if denied). No free tier as of July 2026.
- **Recommendation: SKIP for now.** $497 for a directory backlink is not the right spend at Savvo's stage. Revisit after Pro revenue covers it. Copy below is ready if that day comes.

**Copy (for later):**
- Name: `Savvo`
- Category: AI CRM / Sales Assistant
- Description:
  > AI-powered investor CRM for startup founders. Converts freeform post-meeting notes into structured investor contacts, scores every relationship by freshness, and sends a daily digest of who needs a follow-up. Semantic search, AI follow-up drafts, calendar sync, CSV and Google Contacts import. Free for 50 contacts; Pro $8/mo.

### 2.10 Startup Stash: VERIFIED LIVE, FREE (premium optional)

- **Submit at:** https://startupstash.com/add-listing/
- **Cost:** Free listing available (nofollow link, DR ~64); optional paid tiers for placement. Free is fine.

**Copy:**
- Name: `Savvo`
- Category: CRM / Sales & Marketing Tools (pick the closest CRM category in their picker)
- Description:
  > Savvo is an investor CRM for founders raising a round. Type what you remember after each pitch; AI extracts the contact, firm, and next steps. Health scores flag investor relationships going cold and a daily digest email tells you who to follow up with. Free for 50 contacts, Pro $8/mo or $75/yr.

---

## 3. Community Seeding

### Verified subreddit rules (July 2026)

- **r/startups:** No direct sales, ads, or promotional posts of any kind in regular posts. Promotion is only allowed in the stickied **"Share Your Startup"** megathread (recurring, stickied at the top of the sub). Moderators remove promo posts aggressively. Value posts about your experience are allowed, but keep links out of the body and only name the product if directly asked in comments, with a clear "I built this" disclosure.
- **r/ycombinator:** Rules could not be fetched directly (Reddit blocks unauthenticated fetches); general Reddit policy applies (90/10 participation-to-promotion, authentic content, disclose affiliation). **Before posting there, open the subreddit sidebar and read the current rules manually.** Treat it like r/startups: experience and discussion posts only, no launch posts, product named only when asked and always with disclosure.
- General: comment and participate in each sub for 1 to 2 weeks before posting anything. Never use a second account. Never post the same content to multiple subs.

### Post 1: r/startups experience post (value-first, no links in body)

This adapts the strongest bones of the existing r/startups draft in `REDDIT-POSTS.md` to the investor-raise angle and strips the in-body product plug to comply with r/startups rules.

**Title:** How I tracked my investor outreach without losing my mind (what broke, what worked)

**Body:**

> Solo founder here. When I started raising, my system was the same one every founder seems to use: a spreadsheet with columns for Name, Firm, Status, Intro'd By, Last Contact.
>
> It worked for the first few weeks. Then three things happened in the same month:
>
> 1. An investor offered to intro me to someone relevant. I forgot to follow up inside the window where it was still warm. They never brought it up again.
> 2. I walked into a second meeting having completely forgotten what we covered in the first one. You can feel the temperature of a meeting drop when that happens.
> 3. I opened the sheet one night and realized three warm conversations had quietly gone cold over two months. Not because I didn't care. Because nothing told me.
>
> The realization that changed how I run outreach: a spreadsheet tracks data, it does not track relationships. It will happily hold a row that says "warm, follow up soon" for 90 days without complaint.
>
> What I actually needed, and what I'd suggest to anyone starting a raise, regardless of what tool you use:
>
> 1. **Capture context within an hour of every meeting, in whatever messy form you can.** What they said, what they asked for, who intro'd you, what the next step is. You will not remember it in 48 hours. The founders I know who run tight processes all do some version of this.
> 2. **Make recency visible.** The killer question is not "who did I meet" but "who am I about to lose." A "last contacted" date is useless unless something turns red when it gets stale. Conditional formatting works. Reminders work. Anything that creates urgency works.
> 3. **Review the whole pipeline on a fixed schedule, not when you feel like it.** I do it every morning with coffee. Ten minutes. Who needs a nudge today, who's waiting on materials from me, who's actually dead and should be marked as such.
> 4. **Track the ask, not just the person.** "Sarah, Sequoia" tells you nothing at 11pm. "Sarah, Sequoia, wants Q2 metrics before partner meeting" tells you exactly what to do next.
>
> The uncomfortable truth I learned: most raises don't die from rejection, they die from dropped follow-ups. Investors rarely chase you.
>
> What's your system? Genuinely curious what other founders use once the pipeline passes 30 or 40 conversations, because that's where mine fell apart.

**Comment-style disclosure (use ONLY if someone asks what you use now, never unprompted):**

> Full disclosure, I ended up building my own tool for this (Savvo, savvo.app) because I wanted to type freeform notes and have the structure extracted automatically, plus something that flags investors going cold without me checking. I'm the founder so I'm biased. The framework above works with a spreadsheet too, that's where I started.

### Post 2: r/startups "Share Your Startup" megathread entry

For the stickied thread only, where promotion is explicitly allowed. Follow whatever format the thread's top comment specifies (they usually ask for name, link, and a description).

> **Savvo** (savvo.app), the investor CRM for founders raising a round.
>
> I built it after my own fundraise spreadsheet fell apart. You type what you remember after each pitch ("Met Sarah Chen at Founders Dinner, partner at Sequoia, wants Q2 metrics") and AI extracts the contact, firm, and next step. Every investor gets a health score based on how long since you last talked, and a daily digest email tells you who's going cold. Semantic search means you can ask "who do I know in healthcare AI?" and get real answers.
>
> Free for 50 contacts, no card required. Pro is $8/mo. Solo founder, building in public, changelog is open at savvo.app/changelog. Would love blunt feedback from anyone mid-raise.

### Post 3: Answer template for existing "how do you track investor outreach" threads

Use when you find live threads via F5Bot or search. Lead with genuinely useful advice; the mention comes last and is disclosed. Adjust the first line to respond to their actual situation.

> The thing that matters most is not which tool, it's whether the tool tells you who's going stale without you asking. A raise is a follow-up game: most conversations die from silence, not rejection.
>
> Whatever you pick, make sure it does three things:
>
> 1. Zero-friction capture. If logging a meeting takes more than 30 seconds you'll stop doing it by week three, right when the pipeline gets big enough to matter.
> 2. Recency you can see. Some version of "these five investors are going cold" that surfaces itself, via a daily email, a red flag, a sorted list. A "last contact" column you have to remember to check is the same as nothing.
> 3. Next steps attached to people. "Waiting on them" vs "they're waiting on me" is the difference between a stalled raise and a moving one.
>
> A spreadsheet can do all three if you're disciplined (conditional formatting on last-contact date gets you surprisingly far). Notion and Airtable work too if you'll actually maintain them.
>
> Disclosure: I found the discipline part hard enough that I built a tool for this (Savvo, savvo.app). You type freeform notes and AI structures them, and it emails you each morning with who needs attention. I'm the founder, so weigh that accordingly. Free tier covers a typical seed pipeline.

### F5Bot alert terms

Set up at https://f5bot.com (free, emails you when terms appear on Reddit and Hacker News). Add these terms:

```
savvo
savvo.app
investor crm
fundraising crm
fundraising tracker
investor tracker
investor spreadsheet
investor pipeline spreadsheet
track investors
track investor outreach
airtable fundraising
notion fundraising tracker
fundraising pipeline template
dex crm alternative
folk crm
attio alternative
streak crm alternative
personal crm founders
crm for fundraising
raise tracker
```

Triage rule: only reply where you can add value beyond the pitch, use the Post 3 template, and never reply to more than 1 or 2 threads per week per subreddit (90/10 rule).

---

## 4. Search Console + Bing Setup

Savvo is hosted on Vercel with the domain savvo.app. This is a one-time, roughly 45-minute setup.

### Step 1: Google Search Console verification

1. Go to https://search.google.com/search-console and click "Add property".
2. Choose **Domain** property (not URL prefix) and enter `savvo.app`. Domain property covers http/https and any subdomains in one shot.
3. GSC gives you a **DNS TXT record** (looks like `google-site-verification=...`).
4. Add that TXT record wherever savvo.app's DNS lives:
   - If the domain's nameservers are on **Vercel**: Vercel dashboard → the team/project → Domains → savvo.app → DNS Records → Add → Type `TXT`, Name `@`, Value = the verification string.
   - If the nameservers are still at the **registrar** (Namecheap, GoDaddy, etc.): add the TXT record in the registrar's DNS panel instead. DNS TXT at the source of truth is the cleanest method for a Vercel-hosted site; no code deploy, survives redesigns.
5. Back in GSC, click Verify. DNS can take a few minutes to a few hours to propagate; if it fails, wait and retry.

### Step 2: Submit the sitemap

1. In GSC, left sidebar → **Sitemaps**.
2. Enter `https://savvo.app/sitemap.xml` and submit. (This is generated by `src/app/sitemap.ts` at build time.)
3. **Repo note (do not fix in this file's PR, it belongs to whoever owns sitemap.ts):** `src/app/sitemap.ts` currently lists only 7 URLs and is missing `/templates/investor-tracker` and the new `/blog` and `/vs/` pages from this batch. Make sure the sitemap is updated and redeployed before submitting, or resubmit after the batch deploys.

### Step 3: Request indexing for every public URL

In GSC, paste each URL into the **URL Inspection** bar at the top, wait for the check, then click **"Request Indexing"**. There's a daily quota (roughly 10 to 12 requests), so this takes two days. The full public URL list (~15 pages):

Day 1:
1. `https://savvo.app/`
2. `https://savvo.app/pricing`
3. `https://savvo.app/changelog`
4. `https://savvo.app/install`
5. `https://savvo.app/from-spreadsheet`
6. `https://savvo.app/templates/investor-tracker`
7. `https://savvo.app/blog`
8. `https://savvo.app/privacy`
9. `https://savvo.app/terms`
10. First blog post URL

Day 2:
11. Second blog post URL
12. Third blog post URL
13. First `/vs/` page
14. Second `/vs/` page
15. Third `/vs/` page
16. Fourth `/vs/` page

The three blog posts and four `/vs/` comparison pages are being added in this same growth batch; pull their exact slugs from `https://savvo.app/sitemap.xml` after the branch deploys rather than guessing them here.

### Step 4: Bing Webmaster Tools (feeds ChatGPT search + Copilot)

Bing's index powers ChatGPT search and Microsoft Copilot, which is exactly the AI-citability gap this playbook exists to close. Do not skip this.

1. Go to https://www.bing.com/webmasters and sign in.
2. Choose **"Import from Google Search Console"**: one click, it copies the verified property and sitemap over. No separate DNS verification needed.
3. Confirm `https://savvo.app/sitemap.xml` appears under Sitemaps after import; add it manually if not.
4. Optional: use Bing's own URL Submission tool on the same ~15 URLs (Bing's quota is more generous than Google's).

### Step 5: What to check 7 days later

In **GSC**:
- **Pages report** (Indexing → Pages): how many of the ~15 URLs are "Indexed" vs "Discovered, currently not indexed". Re-request indexing for stragglers.
- **Performance report**: which queries are generating impressions. Expect branded queries ("savvo", "savvo app", "savvo crm") first; the win condition is the first non-branded impressions ("investor crm", "investor tracker spreadsheet", "airtable alternative fundraising", "dex alternative").
- If `/` is indexed but `/vs/` pages are not, check they're in the sitemap and internally linked from the homepage footer.

In **Bing Webmaster**: same two checks (Site Explorer for indexed pages, Search Performance for queries). Bing usually indexes small sites faster than Google.

---

## 5. Week-by-Week Sequence

Realistic for a solo founder at 30 to 60 minutes per day. Directories first (they take days to approve, so the backlinks exist before the PH launch), then the launch, then follow-through.

### Week 1: Foundations (directories + GSC + community groundwork)

| Day | ~Time | Tasks |
|---|---|---|
| Mon | 45 min | GSC domain verification (Step 4.1), submit sitemap. Create AlternativeTo account **today** (the 1-week age requirement means it unlocks next Monday). Create the F5Bot alerts. |
| Tue | 45 min | Request indexing for day-1 batch of URLs. Submit to SaaSHub and Startup Stash (both free, both fast). |
| Wed | 45 min | Request indexing for day-2 batch. Bing Webmaster import from GSC. Submit to Toolify (free queue) and Uneed (free queue). |
| Thu | 45 min | Submit to MicroLaunch. Create the Indie Hackers product page. Start commenting genuinely in r/startups and r/ycombinator (no product mentions, just be useful). |
| Fri | 30 min | Create the PH product page in "coming soon" state. Start warming up the PH account (follow topics, upvote, comment). Enter TAAFT's free indie-maker thread on X if one is live this month. |
| Sat/Sun | 30 min total | Capture and edit the 5 gallery assets (typing-demo GIF, dashboard, reach-out, graph, digest email). Weekend is the best time to do demo-data screenshots undisturbed. |

**Metric to watch:** number of live third-party pages that mention Savvo (target: 4 to 6 directory listings approved by Sunday). This is the raw material AI engines cite.

### Week 2: Product Hunt launch

| Day | ~Time | Tasks |
|---|---|---|
| Mon | 45 min | AlternativeTo account is now a week old: submit the listing. Finalize PH copy (tagline, description, first comment from Section 1). Send the heads-up email to your users: "launching on PH Wednesday, would love your honest feedback there." |
| Tue | 30 min | Final asset check. Schedule the launch for 12:01 AM PT Wednesday. Draft the launch tweet. Early night. |
| Wed (launch) | As much as you can give, in bursts | 12:01 AM: launch goes live, post maker comment. Morning: launch tweet, user email, community shares. All day: reply to every PH comment within 15 minutes for the first 6 hours, then hourly. Spread outreach across the day (the algorithm rewards sustained velocity, not a morning spike). |
| Thu | 45 min | Thank-you replies on PH. Post the results honestly on X ("here's what launch day actually looked like") and as an Indie Hackers product update. Answer any straggler comments. |
| Fri | 30 min | Post the Savvo entry in r/startups "Share Your Startup" megathread (Section 3, Post 2). Log every piece of feedback from PH comments into a single list. |
| Sat/Sun | 15 min total | Check F5Bot digests. Rest. |

**Metric to watch:** PH launch-day signups at savvo.app (watch the referral source, not upvotes; upvotes don't compound, indexed pages and signups do).

### Week 3: Follow-through + blog promotion

| Day | ~Time | Tasks |
|---|---|---|
| Mon | 45 min | Post the r/startups value post (Section 3, Post 1). Stay in the thread replying for the first two hours. |
| Tue | 30 min | GSC + Bing 7-day check (Section 4, Step 5). Re-request indexing on anything stuck. Confirm blog and /vs/ pages are in the sitemap and indexed. |
| Wed | 45 min | Promote blog post 1 on X as a short thread (adapt from TWITTER-THREAD.md style, investor-raise angle) linking to the post. Add the PH badge/link to the site footer if desired. |
| Thu | 30 min | Answer 1 or 2 live "how do you track investor outreach" threads found via F5Bot (Section 3, Post 3 template). Check directory queues (Toolify, Uneed) and complete any approval follow-ups. |
| Fri | 30 min | Promote blog post 2 or the /vs/ pages on X. Post a build-in-public changelog update referencing launch feedback shipped. |
| Sat/Sun | 15 min | F5Bot digest sweep. Note week's numbers. |

**Metric to watch:** non-branded impressions in GSC Performance (queries like "investor crm", "fundraising tracker", competitor-alternative queries). This is the leading indicator that search engines, and therefore AI engines, can now find and cite Savvo.

### After week 3 (steady state, ~30 min/day)

- Reply to every F5Bot hit worth replying to (max 1 or 2 per week per community).
- Ship, then post the changelog entry to X and the Indie Hackers product page. Every update is another indexed mention.
- Re-check GSC monthly; add new pages to the indexing queue as they ship.
- Revisit the paid directories (TAAFT $347, Futurepedia $497) only once Pro revenue makes the math obvious.

---

## Source notes (verified July 2026)

- PH timing, 2026 algorithm (sustained ~20-hour velocity), and 12:01 AM PT convention: producthunt.com/launch, stackmatix.com, launchpact.io guides.
- PH community guidelines (no upvote solicitation; ask for feedback instead): help.producthunt.com/en/articles/3615694-community-guidelines.
- PH image specs (gallery 1270x760, thumbnail 240x240, under 3MB, PNG for stills / GIF for demos): help.producthunt.com/en/articles/479557-how-to-post-a-product, framed-shot.com size guide.
- r/startups promo rules (megathread-only promotion): reddit-radar-marketing.com and redditagency.com r/startups guides; confirm the current stickied thread cadence in the sub before posting.
- Directory statuses: saashub.com/services/submit (free), alternativeto.net FAQ (free, 1-week account age), theresanaiforthat.com pricing ($347 + free monthly X thread), toolify.ai/submit (free queue or $99), betalist.com/criteria + submit (paid, recently-launched preference), uneed.best (free queue or $29.99), microlaunch.net (free), indiehackers.com/products (free with account), futurepedia.io/submit-tool ($497 verified only), startupstash.com/add-listing (free).
