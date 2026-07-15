import Link from "next/link"
import type { Metadata } from "next"
import { VsHeader, VsFooter, ComparisonTable, VsFaq, MoreComparisons } from "../shared"

export const metadata: Metadata = {
  title: "Savvo vs Airtable for Fundraising",
  description: "Looking for an Airtable fundraising template alternative? Compare Airtable's database approach with Savvo, the investor CRM built for founders raising a round.",
  alternates: { canonical: "/vs/airtable" },
  openGraph: {
    title: "Savvo vs Airtable for Fundraising",
    description: "Airtable is a database you configure. Savvo is a note-first investor CRM with built-in relationship health and follow-up nudges. An honest comparison for founders tracking a raise.",
    url: "/vs/airtable",
  },
}

export default function VsAirtablePage() {
  return (
    <div className="min-h-screen bg-background">
      <VsHeader />

      <main className="container mx-auto px-4 max-w-4xl">
        {/* Hero */}
        <section className="py-12 sm:py-20 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] text-xs font-medium mb-6">
            Savvo vs Airtable
          </div>
          <h1 className="text-3xl sm:text-5xl font-normal tracking-tight mb-4 leading-tight">
            The Airtable fundraising template<br />
            <span className="text-[var(--copper)]">makes you the database admin</span>
          </h1>
          <p className="text-stone-700 dark:text-stone-300 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            You downloaded a fundraising template, customized the fields, and it looked great. Then the raise actually started.
            Now every investor update means opening the base, finding the row, and filling in cells by hand, during the busiest
            months of your company&apos;s life.
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
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">A configurable database vs a note-first investor CRM</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            Airtable is a genuinely powerful platform. It positions itself as an app-building platform, and that is exactly what it is:
            you can model almost anything with bases, fields, views, and automations. That flexibility is also the catch for a founder
            mid-raise. The template gives you structure, but you supply all the discipline: entering data cell by cell, keeping status
            fields current, and building any reminder logic yourself with automations. Savvo flips that. You type what you remember
            after each pitch, like &quot;Sarah at Accel is interested, wants Q2 metrics before partner meeting&quot;, and AI extracts the
            name, firm, role, and next step. Health scores and a daily digest handle the remembering for you.
          </p>
          <ComparisonTable
            competitor="Airtable"
            rows={[
              { dimension: "Setup time", them: "Pick a template, then customize fields, views, and automations to fit your raise", savvo: "Sign up and type your first note. Investor tracking is the default, not a template" },
              { dimension: "Data entry after each pitch", them: "Open the base, find the row, fill in cells manually", savvo: "Type one messy sentence. AI extracts name, firm, role, and next step" },
              { dimension: "Follow-up reminders", them: "None by default. You build automations or check the base yourself", savvo: "Daily digest email lists exactly who needs attention, with context" },
              { dimension: "Relationship health", them: "A formula or status field you define and keep updated", savvo: "Automatic color-coded health scores on every contact" },
              { dimension: "Search", them: "Field search, filters, and views; AI features are available separately", savvo: "Semantic search: \"which fintech investors were warm?\" just works" },
              { dimension: "Price for one founder", them: "Free plan with per-base record limits; Team from $20/user/month billed annually", savvo: "Free for 50 contacts; Pro $8/month or $75/year" },
              { dimension: "Learning curve", them: "Moderate: bases, field types, views, and automation logic", savvo: "Minimal: if you can type a text message, you can use it" },
            ]}
          />
          <p className="text-xs text-stone-700 dark:text-stone-300 mt-3 text-center">
            Airtable pricing changes; check <a href="https://airtable.com/pricing" className="underline hover:text-[var(--copper)]" rel="nofollow">airtable.com/pricing</a> for current numbers.
          </p>
        </section>

        {/* When Airtable is better */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">When Airtable is the better choice</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-8 max-w-lg mx-auto">Honestly, sometimes it is. Pick Airtable if any of these describe you.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "You need arbitrary databases", desc: "Airtable can model your hiring pipeline, content calendar, and product roadmap in one platform. Savvo only does relationships. If you want one tool for many databases, Airtable wins." },
              { title: "You want to build custom interfaces", desc: "Airtable's interfaces, views, and automations let you build internal tools on top of your data. Savvo has no app-building layer and never will." },
              { title: "Your team needs shared custom views", desc: "If cofounders and ops teammates each need their own filtered views of the same data, Airtable's per-editor collaboration model is built for exactly that." },
              { title: "You genuinely enjoy the building", desc: "Some founders find setting up the perfect base relaxing. If maintaining the system is not a cost for you, the free plan may be all you need." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border bg-white dark:bg-stone-800 p-5 shadow-refined">
                <h3 className="text-sm font-semibold mb-2 text-stone-900 dark:text-stone-100">{item.title}</h3>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-stone-700 dark:text-stone-300 text-center mt-8 max-w-2xl mx-auto leading-relaxed">
            But if the only database you actually need is &quot;which investors am I talking to and who needs a follow-up,&quot;
            you are paying for flexibility with your own time. During a raise, that time is the scarcest thing you have.
          </p>
        </section>

        {/* FAQ */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-8">Common questions</h2>
          <VsFaq
            items={[
              {
                q: "Can I import my Airtable investor tracker into Savvo?",
                a: "Yes. Export your Airtable base (or any view) as a CSV, then upload it to Savvo. Column mapping handles name, firm, email, and notes fields, and duplicates are detected and skipped during import. Every imported contact gets a health score automatically. CSV import is a Pro feature ($8/month); the free plan supports adding up to 50 contacts by typing notes.",
              },
              {
                q: "Is Savvo a database like Airtable?",
                a: "No, and it does not try to be. Airtable is a general-purpose database platform; Savvo is a purpose-built investor CRM. You cannot create arbitrary tables, custom field types, or automations in Savvo. In exchange, relationship health, follow-up reminders, and semantic search work out of the box with zero configuration.",
              },
              {
                q: "What happens to my data if I switch and change my mind?",
                a: "You can export all your Savvo contacts as a CSV at any time, or download everything Savvo stores about you as JSON in one click. Your data is never locked in, so moving back to Airtable later is a straightforward CSV import.",
              },
            ]}
          />
        </section>

        {/* Final CTA */}
        <section className="py-12 sm:py-20 text-center">
          <h2 className="text-3xl tracking-tight mb-3">
            Stop maintaining the tracker.<br />
            <span className="text-[var(--copper)]">Start closing the round.</span>
          </h2>
          <p className="text-stone-700 dark:text-stone-300 mb-6 max-w-md mx-auto">
            Import your Airtable base as a CSV, or start fresh. Type what you remember after your next pitch and watch it structure itself.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
          >
            Get Started Free
          </Link>
        </section>

        <MoreComparisons current="/vs/airtable" />
      </main>

      <VsFooter />
    </div>
  )
}
