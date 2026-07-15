import Link from "next/link"
import type { Metadata } from "next"
import { VsHeader, VsFooter, ComparisonTable, VsFaq, MoreComparisons } from "../shared"

export const metadata: Metadata = {
  title: "Savvo vs Notion for Investor Tracking",
  description: "Looking for a Notion investor tracker alternative? Compare Notion's database templates with Savvo, the investor CRM that reminds you who to follow up with.",
  alternates: { canonical: "/vs/notion" },
  openGraph: {
    title: "Savvo vs Notion for Investor Tracking",
    description: "A Notion investor tracker is a page you have to remember to open. Savvo emails you who needs attention. An honest comparison for founders.",
    url: "/vs/notion",
  },
}

export default function VsNotionPage() {
  return (
    <div className="min-h-screen bg-background">
      <VsHeader />

      <main className="container mx-auto px-4 max-w-4xl">
        {/* Hero */}
        <section className="py-12 sm:py-20 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] text-xs font-medium mb-6">
            Savvo vs Notion
          </div>
          <h1 className="text-3xl sm:text-5xl font-normal tracking-tight mb-4 leading-tight">
            Your Notion investor tracker<br />
            <span className="text-[var(--copper)]">only works when you open it</span>
          </h1>
          <p className="text-stone-700 dark:text-stone-300 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            The template was beautiful. Status tags, a kanban view, a column for next steps. But a Notion database is passive:
            it holds whatever you type and tells you nothing. Three weeks into the raise, the tracker is out of date, and the
            investor who asked for your metrics deck has been waiting nine days.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
            >
              Track Your Raise Free
            </Link>
            <Link
              href="/#how"
              className="inline-flex items-center justify-center px-6 py-4 rounded-xl text-base font-medium border hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
            >
              See How It Works
            </Link>
          </div>
          <p className="text-xs text-stone-700 dark:text-stone-300 mt-3">Free plan includes 50 contacts. No credit card required.</p>
        </section>

        {/* The core difference */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">A workspace that waits vs a CRM that nudges</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            Notion&apos;s pitch is one tool to run your company, and as a workspace for docs, wikis, and project databases it has
            earned that. The gap shows up in the specific job of a raise. A Notion tracker requires you to open the page, find
            the row, and fill in properties by hand after every pitch, then remember to come back and check it. Nothing surfaces
            the investor who has gone quiet. Savvo works the other way around: you type what you remember in one sentence, AI
            extracts the structure, every contact gets a health score, and each morning a digest email tells you who needs
            attention. The system reaches out to you.
          </p>
          <ComparisonTable
            competitor="Notion"
            rows={[
              { dimension: "Setup time", them: "Duplicate a template, then adapt properties and views to your raise", savvo: "Sign up and type your first note. No template to maintain" },
              { dimension: "Data entry after each pitch", them: "Open the page, find the row, fill in properties by hand", savvo: "Type one messy sentence. AI extracts name, firm, role, and next step" },
              { dimension: "Follow-up reminders", them: "Date properties and page reminders you configure in the tracker", savvo: "Daily digest email plus per-contact cadences and snooze, on by default" },
              { dimension: "Relationship health", them: "None. A status tag stays whatever you last set it to", savvo: "Automatic color-coded health scores based on when you actually last talked" },
              { dimension: "Search", them: "Keyword search across pages and databases", savvo: "Semantic search: \"who was the climate-focused angel?\" finds them by meaning" },
              { dimension: "Price for one founder", them: "Free plan for individuals; Plus from around $10/user/month", savvo: "Free for 50 contacts; Pro $8/month or $75/year" },
              { dimension: "Learning curve", them: "Low to start, real effort to build and maintain good database views", savvo: "Minimal: type notes, read the morning digest" },
            ]}
          />
          <p className="text-xs text-stone-700 dark:text-stone-300 mt-3 text-center">
            Notion pricing changes; check <a href="https://www.notion.com/pricing" className="underline hover:text-[var(--copper)]" rel="nofollow">notion.com/pricing</a> for current numbers.
          </p>
        </section>

        {/* When Notion is better */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">When Notion is the better choice</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-8 max-w-lg mx-auto">Notion is a great workspace. Keep your tracker there if these fit you.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Everything else already lives in Notion", desc: "If your pitch deck notes, meeting docs, and company wiki are all in Notion, one more database keeps everything in a single workspace. Tool consolidation is a real benefit." },
              { title: "You're collaborating on raise materials", desc: "Cofounders drafting the memo, data room checklists, and diligence docs together is exactly what Notion is for. Savvo has no docs, pages, or collaborative editing." },
              { title: "You want rich context on each page", desc: "A Notion row can open into a full page with embedded call notes, files, and links. If long-form context per investor matters more than reminders, Notion's format is richer." },
              { title: "Free matters and volume is low", desc: "If you are tracking a dozen conversations and check the page daily out of habit, Notion's free plan honestly may be all the tracker you need." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border bg-white dark:bg-stone-800 p-5 shadow-refined">
                <h3 className="text-sm font-semibold mb-2 text-stone-900 dark:text-stone-100">{item.title}</h3>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-stone-700 dark:text-stone-300 text-center mt-8 max-w-2xl mx-auto leading-relaxed">
            The two are not mutually exclusive. Many founders keep the deck, memo, and data room in Notion and move just the
            investor pipeline to Savvo, because the pipeline is the part that punishes you for forgetting.
          </p>
        </section>

        {/* FAQ */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-8">Common questions</h2>
          <VsFaq
            items={[
              {
                q: "Can I import my Notion investor tracker into Savvo?",
                a: "Yes. Export your Notion database as a CSV (Export from the page menu, CSV format), then upload it to Savvo. Column mapping handles name, firm, email, and notes, duplicates are skipped automatically, and every contact gets a health score on import. CSV import is a Pro feature ($8/month).",
              },
              {
                q: "Should I stop using Notion if I switch?",
                a: "No. Savvo replaces the investor tracker database, not your workspace. Docs, wikis, pitch materials, and project boards stay in Notion, where they belong. Savvo takes over the one job Notion does not do well for a raise: remembering who needs a follow-up and telling you before it is too late.",
              },
              {
                q: "Does Savvo have docs or pages like Notion?",
                a: "No. Savvo stores notes, structured details, and a full activity timeline per contact, but it is not a documents tool and does not try to be one. If you need long-form collaborative writing, keep Notion alongside it.",
              },
            ]}
          />
        </section>

        {/* Final CTA */}
        <section className="py-12 sm:py-20 text-center">
          <h2 className="text-3xl tracking-tight mb-3">
            Keep your docs in Notion.<br />
            <span className="text-[var(--copper)]">Move your raise to Savvo.</span>
          </h2>
          <p className="text-stone-700 dark:text-stone-300 mb-6 max-w-md mx-auto">
            Export your tracker as a CSV and import it in minutes, or start fresh with your next pitch note.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
          >
            Get Started Free
          </Link>
        </section>

        <MoreComparisons current="/vs/notion" />
      </main>

      <VsFooter />
    </div>
  )
}
