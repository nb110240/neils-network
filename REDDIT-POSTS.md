# Reddit Posts — Savvo Launch

Reddit hates self-promo. These posts lead with value, tell a real story, and mention Savvo only when it's natural. Post from your personal account, not a brand account.

---

## Post 1: r/startups

**Title:** I was tracking my network in a Google Sheet. At 50 contacts, it completely fell apart.

**Body:**

Solo founder here. I meet 10-15 new people a week — investors, founders, potential hires, conference contacts. For a year, I tracked everyone in a spreadsheet.

It worked fine until about 50 contacts. Then three things happened in the same month:

1. An investor offered to intro me to their LP. I forgot to follow up. They never brought it up again.
2. I ran into someone at a conference I'd already met. Didn't remember. Awkward.
3. I realized 3 warm investor relationships had gone completely cold over 2 months. Not because I didn't care — because nothing reminded me.

The spreadsheet tracked data. It didn't track relationships.

**What I tried first:**

- HubSpot — way too heavy. I don't need a sales pipeline, I need to remember people.
- Notion database — same problem as the spreadsheet, just prettier.
- Setting calendar reminders — this doesn't scale past 20 people.

**What I ended up building:**

I built a tool where you just type what you remember about someone: "Met Sarah at TechCrunch, she runs a fintech startup, looking for a head of sales, intro'd by Mike, should follow up next week."

AI extracts the name, company, role, how you met, and next steps. No forms, no fields.

Every contact gets a health score based on when you last interacted. Green → yellow → orange → red. Dashboard shows who's going cold, sorted by urgency.

The feature I didn't expect to love: semantic search. I can ask "who do I know in healthcare AI?" and it finds contacts by meaning, not just exact text matches.

I've been using it daily for a few months and it changed how I network. I actually follow up now because the tool makes it obvious who needs attention.

It's called Savvo (savvo.app) — free tier covers the basics. Would love feedback from other founders who deal with the same "too many connections, not enough follow-through" problem.

**What's your system for staying on top of your network?**

---

## Post 2: r/SideProject

**Title:** I built an AI relationship manager because my Google Sheet CRM was killing my network

**Body:**

Been building this for a few months as a solo dev. Sharing what I built and what I learned.

**The problem:** I meet a lot of people through startup life — investors, founders, people at events. I was tracking them in a spreadsheet. It worked until ~50 contacts, then it became a graveyard of names I felt guilty about not following up with.

**The product:** Savvo (savvo.app) — you type messy notes about someone you met, AI extracts the structured data. Every contact gets a color-coded health score (green/yellow/orange/red) based on recency. Dashboard tells you who's going cold.

**Tech stack for the nerds:**
- Next.js 16 + React 19
- Supabase (auth, postgres, edge functions)
- OpenAI for entity extraction + semantic search
- Stripe for billing
- Vercel for hosting
- PWA — works offline, installable on phone

**What I learned building it:**

1. The biggest competitor isn't other CRMs — it's non-consumption. Most people just... don't track their network at all. The ones who do use spreadsheets.

2. Forms kill adoption. The moment you ask someone to fill in "First Name, Last Name, Company, Role, How You Met" — they won't do it after a networking event when they have 8 new contacts. Natural language input was the unlock.

3. AI extraction is good enough ~95% of the time. The 5% where it misses is fine because you can always edit. But 95% accuracy with zero effort beats 100% accuracy with manual data entry every time.

4. Health scores sound simple but they changed my behavior. Seeing a contact turn from green to yellow creates just enough urgency to actually reach out.

Would love feedback. What would make you switch from your current system (or no system)?

---

## Post 3: r/Entrepreneur

**Title:** The networking advice nobody gives: it's not about meeting people, it's about not losing them

**Body:**

I've been in startup world for a while and I noticed something: everyone talks about how to MEET people. Go to events. Send cold emails. Get warm intros.

Nobody talks about the harder problem: keeping relationships alive after you meet them.

I tracked my own data. Over a 6-month period, I met ~200 new professional contacts. By the end of that period:

- I was actively in touch with maybe 30 of them
- ~50 had gone completely cold (180+ days, no interaction)
- ~120 were somewhere in between — technically "in my network" but drifting

The 50 that went cold included 3 investors, a potential cofounder, and someone who'd offered to intro me to a major customer. All gone because I simply... forgot.

**The math is brutal:** if you meet 10 people/week but only maintain 20 relationships, your network isn't growing. It's churning.

**What actually helped me:**

I built a system (ended up turning it into a product called Savvo) that gives every contact a health score based on recency. My dashboard literally shows me "these 5 people are going cold — reach out today."

But the tool isn't the point. The point is: **you need a system. Any system.** Whether it's:

- A spreadsheet with a "last contacted" column you actually check weekly
- Calendar reminders for your top 50 contacts
- A CRM (mine or anyone else's)
- Even a physical notebook where you review names every Sunday

The people who are "great networkers" aren't more charismatic than you. They just have a follow-up system.

**What's yours?**

---

## Post 4: r/indiehackers (or Indie Hackers website)

**Title:** From Google Sheet to shipped product in 3 months — building an AI CRM as a solo founder

**Body:**

Sharing my build journey. Solo founder, no funding, shipping with AI tools.

**Timeline:**
- Month 1: n8n bot on Telegram (proof of concept — could I extract contact info from messy text?)
- Month 2: Rebuilt as a Next.js web app with Supabase. Core loop: type → extract → track health
- Month 3: Polish, pricing, onboarding, SEO, security audit. Shipped to production.

**Revenue model:** Free tier (unlimited contacts, basic search, health scores) + Pro at $8/mo (LinkedIn import, CSV import, calendar sync, daily digest email, semantic search).

**What's working:**
- Natural language input — people actually use it because there's zero friction
- Health scores — simple concept but it changes behavior
- PWA — works like a native app on phones, which is where people add contacts right after meeting someone

**What's not working yet:**
- Distribution. Product is ahead of distribution by a mile. Building in public starting now.
- No users yet besides me. Need to find the first 10.

**Tech decisions I'd make again:**
- Supabase over Firebase — row-level security is incredible, postgres is just better
- Next.js App Router — server components for fast initial loads, client components where needed
- OpenAI for extraction — tried to build my own, wasted a week, just use the API
- Stripe — took 2 hours to set up billing. Don't build your own.

**Tech decisions I'd change:**
- Would've started with the web app, not the Telegram bot. The bot was a useful prototype but none of that code transferred.

If you're building a personal CRM or relationship tool, happy to share more details on the AI extraction pipeline or the health score algorithm.

savvo.app if you want to try it.

---

## Post 5: r/productivity

**Title:** I built a system to never lose a professional relationship again

**Body:**

I'm a founder who meets a lot of people. After I realized I'd let 3 important investor relationships go completely cold — not because I didn't care, but because nothing reminded me — I built a system.

**The core idea:** every relationship has a "temperature." If you talked to someone last week, they're warm. If it's been 3 months, they're cooling. 6 months? Cold.

The problem is we can't feel this temperature for 200+ contacts. We need something to make it visible.

**My system:**

Every contact gets a health score:
- 🟢 Active (last 30 days)
- 🟡 Cooling (31-90 days)
- 🟠 Going cold (91-180 days)
- 🔴 Cold (180+ days)

Every day, I check: who's turning yellow? Those are the people I reach out to. A 2-minute "hey, saw this article and thought of you" message resets someone from yellow to green.

**The result:** My network stopped shrinking. I went from maintaining ~30 active relationships to ~80. Not because I'm spending more time networking — because I'm spending it on the right people at the right time.

I originally did this in a spreadsheet with conditional formatting. Eventually built a tool for it (Savvo — savvo.app) because the spreadsheet version was too manual. But the concept works with any tool.

**The key insight:** Relationship maintenance isn't about being more social. It's about having a system that tells you WHO needs attention TODAY. Everything else is noise.

Anyone else have a system for this? Curious what works for other people.

---

## Posting Strategy

**Order:** Post 3 (r/Entrepreneur) first — it's the most value-forward and least self-promotional. Then Post 1 (r/startups) a day later. Post 4 (r/indiehackers) on day 3. Post 5 (r/productivity) on day 4. Post 2 (r/SideProject) on day 5.

**Timing:** Post between 9-11am ET on weekdays (peak Reddit engagement for business subs).

**Rules:**
1. Reply to EVERY comment within the first 2 hours. Reddit rewards engagement.
2. Don't be defensive about criticism — agree, learn, ask follow-up questions.
3. If someone suggests a competitor, say "I'll check it out, thanks" — don't trash-talk.
4. If someone asks a technical question, go deep. Reddit loves technical depth from builders.
5. Don't crosspost. Each post is unique to the subreddit's culture.
6. Upvote and comment on other posts in these subs for a few days before posting — don't be a drive-by poster.

**Subreddits to monitor after posting (via F5Bot or manually):**
- r/startups, r/SideProject, r/Entrepreneur, r/indiehackers, r/productivity
- r/CRM, r/networking (if they exist and are active)
- Any thread about "how do you manage your network" or "CRM for personal use"
