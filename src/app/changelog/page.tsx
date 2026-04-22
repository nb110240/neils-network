import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Changelog — Savvo",
  description: "What's new in Savvo. Recent updates, features, and fixes.",
  openGraph: {
    title: "Changelog — Savvo",
    description: "What's new in Savvo.",
    url: "https://savvo.app/changelog",
  },
}

interface Release {
  version: string
  date: string
  title: string
  highlights: string[]
}

const RELEASES: Release[] = [
  {
    version: "v0.6",
    date: "2026-04-22",
    title: "Gold-standard product polish",
    highlights: [
      "New sort dropdown on /contacts: Recently added, Last contacted, Needs attention, Name A-Z, Health",
      "Scheduling/cadence now shapes the daily digest and /reach-out priority order",
      "Logged-in users land on /dashboard instead of a features guide",
      "LinkedIn import now blocks duplicates with a clear conflict message instead of silently inserting",
      "Meeting prep upgrade flow matches the rest of the Pro-gate UX",
      "Calendar connect tooltip: auto-syncs daily, click for a manual sync",
      "Finished the data.error error-message sweep — failures now show the real reason",
      "Data export: download everything Savvo stores about you as JSON, in one click",
      "Install prompt on dashboard for users on supported browsers",
      "Public changelog (you're reading it) and security contact at /.well-known/security.txt",
    ],
  },
  {
    version: "v0.5",
    date: "2026-04-20",
    title: "Dedup gold standard + security hardening",
    highlights: [
      "Duplicate detection rebuilt: side-by-side diff, merge preview, confidence tiers, bulk high-confidence merge, and one-click undo",
      "Proactive duplicates banner on /contacts linking to the review flow",
      "Semantic-similarity fallback via contact embeddings catches 'Bob Smith' vs 'Robert Smith, Inc.'",
      "Cloudflare Turnstile on signup — blocks bot signups at Supabase Auth layer",
      "Weekly cleanup cron deletes unverified users after 7 days",
      "Upgraded Next.js to 16.2.4 + patched vite (closed 9 high-severity CVEs)",
      "Fixed a hydration error on /dashboard that was firing for 10 users",
      "Six rounds of adversarial code review applied to auto-merge, calendar sync, and import paths",
    ],
  },
  {
    version: "v0.4",
    date: "2026-04-13",
    title: "Scheduling + cadence",
    highlights: [
      "Set a cadence on any contact: Weekly, Every 2 weeks, Monthly, Quarterly, or custom",
      "Schedule one-off follow-ups for a specific date",
      "Snooze a contact for 3 days, 1 week, or 2 weeks if they're not ready yet",
      "Cadence-aware health score — your pace overrides the default thresholds",
      "Dashboard Reach Out list surfaces contacts due today first",
      "Ten adversarial-review polish items: clearer pricing copy, softer marketing tone, trust signals in the nav, accessibility labels on health badges",
      "Stripe checkout fix for Vercel serverless environments",
    ],
  },
  {
    version: "v0.3",
    date: "2026-03-24",
    title: "First users + distribution",
    highlights: [
      "Shipped to real users; ingested first-round feedback same-day",
      "Onboarding checklist + dashboard walkthrough for new users",
      "Intros flow: Savvo suggests who in your network to introduce",
      "Welcome experience redesigned for speed",
    ],
  },
  {
    version: "v0.2",
    date: "2026-03-21",
    title: "Foundations",
    highlights: [
      "Health scoring across every contact, color-coded by freshness",
      "Daily and weekly digest emails",
      "Google Contacts import + CSV import for Pro users",
      "LinkedIn URL import",
      "Semantic search over your network",
      "Security headers, RLS on every table, audit logging",
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Savvo
        </Link>

        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-normal font-[family-name:var(--font-dm-serif)] text-stone-900 dark:text-stone-100">
            Changelog
          </h1>
          <p className="text-base text-muted-foreground mt-3 max-w-xl">
            What's shipped in Savvo, newest first. Built in the open by{" "}
            <Link href="https://x.com/neilbajaj" className="text-[var(--copper)] hover:underline">
              @neilbajaj
            </Link>
            .
          </p>
        </header>

        <div className="space-y-12">
          {RELEASES.map((r) => (
            <section
              key={r.version}
              className="pl-6 border-l-2 border-[var(--copper)]/20 hover:border-[var(--copper)]/40 transition-colors"
            >
              <div className="flex items-baseline gap-3 mb-1 flex-wrap">
                <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                  {r.version}
                </h2>
                <span className="text-sm text-muted-foreground font-mono">
                  {new Date(r.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <h3 className="text-lg font-medium text-[var(--copper)] mb-3">{r.title}</h3>
              <ul className="space-y-2 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                {r.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--copper)] shrink-0 mt-[0.35em]">—</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-16 pt-8 border-t border-stone-200 dark:border-stone-800 text-sm text-muted-foreground">
          <p>
            Suggestions or bugs? Email{" "}
            <Link href="mailto:neil@savvo.app" className="text-[var(--copper)] hover:underline">
              neil@savvo.app
            </Link>{" "}
            or reach out on{" "}
            <Link href="https://x.com/neilbajaj" className="text-[var(--copper)] hover:underline">
              X
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  )
}
