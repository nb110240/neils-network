# GEO Audit Report: Savvo

**Audit Date:** March 24, 2026
**URL:** https://savvo.app
**Business Type:** SaaS (Personal CRM)
**Pages Analyzed:** 4 (homepage, pricing, privacy, terms)

---

## Executive Summary

**Overall GEO Score: 28/100 (Critical)**

Savvo has a polished product with strong security headers and a clear value proposition, but it is nearly invisible to AI systems. Zero structured data, no robots.txt, no sitemap, no llms.txt, zero third-party brand mentions, and no content beyond the landing page. AI search engines have almost nothing to cite, quote, or recommend. The good news: the fixes are straightforward and high-leverage.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability | 30/100 | 25% | 7.5 |
| Brand Authority | 5/100 | 20% | 1.0 |
| Content E-E-A-T | 20/100 | 20% | 4.0 |
| Technical GEO | 45/100 | 15% | 6.75 |
| Schema & Structured Data | 5/100 | 10% | 0.5 |
| Platform Optimization | 5/100 | 10% | 0.5 |
| **Overall GEO Score** | | | **28/100** |

---

## Critical Issues (Fix Immediately)

### 1. No robots.txt file
**URL:** https://savvo.app/robots.txt → 404
**Impact:** Search engines and AI crawlers have no guidance on what to crawl. While they default to "crawl everything," a missing robots.txt is a negative signal for crawler trust.
**Fix:** Create `/public/robots.txt`:
```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://savvo.app/sitemap.xml
```

### 2. No sitemap.xml
**URL:** https://savvo.app/sitemap.xml → 404
**Impact:** AI crawlers and search engines can't discover your pages efficiently. Critical for indexation.
**Fix:** Create a static sitemap or use next-sitemap package. Include: /, /pricing, /privacy, /terms, plus any future blog posts.

### 3. Zero JSON-LD structured data
**Impact:** AI systems use schema.org markup to understand entity relationships, product details, and page context. Without it, Savvo is a black box.
**Fix:** Add to homepage:
- `Organization` schema (name, url, logo, description, founder)
- `SoftwareApplication` schema (name, applicationCategory, offers, operatingSystem)
- `FAQPage` schema for any FAQ content

### 4. No llms.txt file
**URL:** https://savvo.app/llms.txt → 404
**Impact:** llms.txt is the emerging standard for helping AI systems understand your site. It's the single highest-leverage GEO file you can create.
**Fix:** Create `/public/llms.txt` explaining what Savvo is, who it's for, key features, and pricing.

### 5. Zero brand mentions anywhere on the web
**Impact:** AI models build entity graphs from third-party mentions. Savvo has zero mentions on Reddit, YouTube, LinkedIn, Wikipedia, Product Hunt, or any "best personal CRM" listicle. AI systems literally don't know Savvo exists as an entity.
**Fix:** This is your #1 marketing priority. See Quick Wins below.

---

## High Priority Issues

### 6. No blog or content hub
**Impact:** The site has exactly 4 pages. AI systems cite sites with topical authority — which requires content. No blog means no long-tail keywords, no question-answering content, and no reason for AI to reference Savvo.
**Fix:** Launch a blog at /blog with 3 content pillars:
1. "Networking is broken" (problem-aware content)
2. "How to network" (solution-aware content)
3. "Building Savvo" (brand-building, founder story)

### 7. No author/team/about page
**Impact:** E-E-A-T requires demonstrated expertise. AI systems look for author credentials, team pages, and founder bios to assess trustworthiness.
**Fix:** Create /about with Neil's bio, photo, story, and social links. Link to it from the footer.

### 8. No FAQ section on homepage
**Impact:** FAQ content is the single most citable content format for AI systems. Questions match how users ask AI assistants.
**Fix:** Add 5-8 FAQs to the homepage: "What is Savvo?", "How does the health score work?", "Is my data private?", "How does AI extraction work?", "What's the difference between free and pro?"

### 9. Privacy policy is too thin (320 words)
**Impact:** AI systems use privacy policy quality as a trust signal. 320 words lacks GDPR/CCPA specifics, cookie policy, data retention periods, and third-party processor details.
**Fix:** Expand to ~1,500 words covering: cookies, data retention, GDPR rights, CCPA rights, third-party processors (Supabase, Stripe, OpenAI, Resend, Sentry), international data transfers.

### 10. No social media presence linked from site
**Impact:** No Twitter/X, LinkedIn, or other social profiles linked from the footer. These are entity verification signals for AI.
**Fix:** Create Savvo accounts on Twitter/X and LinkedIn. Link from footer. Add `sameAs` property to Organization schema.

---

## Medium Priority Issues

### 11. OG image not verified
The homepage has OG tags but unclear if a custom OG image exists for social sharing. AI overview panels use OG images.

### 12. Pricing page lacks structured data
The pricing tiers (Free/$0, Pro/$5-8, Team/$12) should have `Offer` schema for AI systems to accurately cite pricing.

### 13. No canonical tags verified
Ensure every page has explicit `<link rel="canonical">` to prevent duplicate content.

### 14. Terms of service too thin (600 words)
While not directly a GEO factor, comprehensive legal pages contribute to overall site trust signals.

### 15. No "comparison" or "alternative" content
Pages like "Savvo vs Dex" or "Savvo vs Clay" are highly citable by AI when users ask "what are alternatives to [competitor]?"

---

## Low Priority Issues

### 16. No RSS feed for future blog
When blog launches, include RSS/Atom feed for content syndication.

### 17. Missing hreflang tags
Not critical for US-only launch, but plan for i18n if expanding.

### 18. PWA manifest present but no service worker
manifest.json exists but unclear if offline capability is active. Not a GEO factor but affects Core Web Vitals.

---

## Category Deep Dives

### AI Citability (30/100)

**What's working:**
- Clear, concise feature descriptions on homepage
- Good meta description ("Keep every connection alive...")
- Self-contained feature blocks ("Every contact gets a color-coded score. Green means active. Red means you're about to lose touch.")

**What's failing:**
- Only ~1,300 words of total content on the entire site
- No question-answering content (FAQs, how-tos, guides)
- No statistics or data points (e.g., "the average professional loses touch with 60% of their network within 6 months")
- No comparison content for competitive queries
- Content is purely marketing copy — not informational content that AI can cite

**Citability score of key passages:**
- "Just type what you remember. Name, company, context, and next steps are extracted automatically." — **65/100** (good self-contained answer)
- "Every contact gets a color-coded score. Green means active. Red means you're about to lose touch." — **70/100** (highly quotable)
- Overall site citability is low because there's simply not enough content to cite.

### Brand Authority (5/100)

**Platform presence:**
| Platform | Present? | Notes |
|---|---|---|
| Reddit | No | Zero mentions |
| YouTube | No | Zero videos |
| LinkedIn | No | No company page found |
| Twitter/X | Unknown | No link from site |
| Product Hunt | No | Not launched |
| Wikipedia | No | Not notable yet |
| "Best of" listicles | No | Not mentioned in any "best personal CRM" articles |
| Hacker News | Unknown | No mentions found |

**Entity recognition:** AI systems do NOT recognize "Savvo" as a known entity. When asked about personal CRMs, AI will recommend Clay, Dex, Monica, Folk, Cloze — but never Savvo.

### Content E-E-A-T (20/100)

| Signal | Status |
|---|---|
| **Experience** | None demonstrated — no case studies, user stories, or founder journey |
| **Expertise** | None demonstrated — no blog posts, guides, or thought leadership |
| **Authoritativeness** | None — zero third-party citations or backlinks |
| **Trustworthiness** | Moderate — privacy policy exists, security headers are strong, data ownership is clear |

### Technical GEO (45/100)

**What's strong:**
- HTTPS with HSTS (strict-transport-security: max-age=31536000)
- Comprehensive Content-Security-Policy header
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Server-side rendered (Next.js SSR, not client-only)
- Font preloading for performance
- Vercel hosting (fast CDN)

**What's missing:**
- No robots.txt (critical)
- No sitemap.xml (critical)
- No llms.txt (critical)
- No JSON-LD structured data
- Cache-Control: no-cache on all pages (aggressive — could allow public caching for static pages)

### Schema & Structured Data (5/100)

**Found:** Nothing. Zero JSON-LD, zero Microdata, zero RDFa.

**Missing (critical):**
- Organization schema
- SoftwareApplication schema
- WebSite schema with SearchAction
- FAQPage schema
- BreadcrumbList schema

**Missing (nice to have):**
- Offer schema for pricing
- Person schema for founder
- Review/AggregateRating (when available)

### Platform Optimization (5/100)

Savvo is optimized for zero AI platforms:
- **Google AI Overviews:** No structured data, no FAQ content, no topical authority
- **ChatGPT Web Search:** No llms.txt, no brand entity, no third-party mentions
- **Perplexity:** No citable content, no comparison pages, no statistics
- **Claude:** No llms.txt, no Wikipedia/Reddit presence
- **Bing Copilot:** No schema markup, no FAQ, no brand signals

---

## Quick Wins (Implement This Week)

1. **Create robots.txt + sitemap.xml** — 15 minutes. Unlocks proper crawling.
2. **Create llms.txt** — 30 minutes. Describes Savvo to AI systems in their preferred format.
3. **Add Organization + SoftwareApplication JSON-LD to homepage** — 1 hour. Establishes entity identity.
4. **Add FAQ section to homepage with FAQPage schema** — 2 hours. Creates citable Q&A content.
5. **Post on Reddit r/productivity, r/networking, r/startups** — 1 hour. Creates first third-party mentions. (Use F5Bot to monitor for ongoing opportunities.)

## 30-Day Action Plan

### Week 1: Technical Foundation
- [ ] Create /public/robots.txt with AI crawler directives
- [ ] Create /public/sitemap.xml (or install next-sitemap)
- [ ] Create /public/llms.txt
- [ ] Add Organization JSON-LD to homepage layout
- [ ] Add SoftwareApplication JSON-LD to homepage
- [ ] Add FAQPage JSON-LD + FAQ section to homepage
- [ ] Create /about page with founder bio, photo, social links

### Week 2: Brand Presence
- [ ] Create Twitter/X account for Savvo, link from footer
- [ ] Create LinkedIn company page, link from footer
- [ ] Add sameAs to Organization schema
- [ ] Post Savvo on Product Hunt (or queue for launch)
- [ ] Write first Reddit posts (r/startups, r/productivity, r/SideProject)
- [ ] Set up F5Bot alerts for "personal CRM", "relationship manager", competitor names

### Week 3: Content Foundation
- [ ] Launch /blog with first 3 posts:
  - "Why I Built a Personal CRM for Founders" (founder story, high E-E-A-T)
  - "The Networking Follow-Up Problem (And How AI Solves It)" (problem-aware)
  - "Personal CRM Comparison: Savvo vs Clay vs Dex vs Monica" (competitor queries)
- [ ] Add Article schema to blog posts
- [ ] Add author bio component to blog with Person schema
- [ ] Expand privacy policy to ~1,500 words

### Week 4: Optimization
- [ ] Add Offer schema to pricing page
- [ ] Create "Savvo vs [Competitor]" pages for top 3 competitors
- [ ] Add statistics and data points to homepage ("The average professional...")
- [ ] Submit site to Google Search Console
- [ ] Request indexing for key pages
- [ ] Monitor AI search visibility for "personal CRM for founders"

---

## Appendix: Pages Analyzed

| URL | Title | Status | GEO Issues |
|---|---|---|---|
| https://savvo.app | Savvo — AI Relationship Manager | 200 | No schema, no FAQ, no llms.txt |
| https://savvo.app/pricing | Savvo — AI Relationship Manager | 200 | No Offer schema, same meta as homepage |
| https://savvo.app/privacy | Savvo — AI Relationship Manager | 200 | Too thin (320 words), no schema |
| https://savvo.app/terms | Terms of Service | 200 | Thin (600 words), no schema |
| https://savvo.app/robots.txt | — | 404 | Missing entirely |
| https://savvo.app/sitemap.xml | — | 404 | Missing entirely |
| https://savvo.app/llms.txt | — | 404 | Missing entirely |

---

*Generated by GEO Audit on March 24, 2026*
