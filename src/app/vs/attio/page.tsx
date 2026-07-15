import Link from "next/link"
import type { Metadata } from "next"
import { VsHeader, VsFooter, ComparisonTable, VsFaq, MoreComparisons } from "../shared"

export const metadata: Metadata = {
  title: "Savvo vs Attio: An Alternative for Founders",
  description: "Looking for an Attio alternative for founders? Compare Attio's team GTM CRM with Savvo, the note-first investor CRM for a solo founder running a raise.",
  alternates: { canonical: "/vs/attio" },
  openGraph: {
    title: "Savvo vs Attio: An Alternative for Founders",
    description: "Attio is a powerful CRM built for go-to-market teams. Savvo is built for one founder closing a round. An honest comparison of both.",
    url: "/vs/attio",
  },
}

export default function VsAttioPage() {
  return (
    <div className="min-h-screen bg-background">
      <VsHeader />

      <main className="container mx-auto px-4 max-w-4xl">
        {/* Hero */}
        <section className="py-12 sm:py-20 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--copper)]/10 text-[var(--copper-text)] text-xs font-medium mb-6">
            Savvo vs Attio
          </div>
          <h1 className="text-3xl sm:text-5xl font-normal tracking-tight mb-4 leading-tight">
            A CRM for your future sales team,<br />
            <span className="text-[var(--copper-text)]">or a CRM for your raise right now</span>
          </h1>
          <p className="text-stone-700 dark:text-stone-300 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Attio is one of the best modern CRMs on the market, built for go-to-market teams from, in their words, zero to IPO.
            But mid-raise, you are not building a go-to-market machine. You are one person trying to remember what 50 investors
            said and who needs a follow-up tomorrow. Those are different problems.
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
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">Configurability vs capture speed</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            Attio&apos;s power comes from its data model: custom objects, flexible attributes, views, automations, and automatic
            enrichment that syncs contacts from your email and calendar. Configured well, it becomes the operating system for a
            revenue team. That is also the tradeoff: someone has to do the configuring, and per-seat pricing (Plus from around
            $29/user/month billed annually) reflects a product designed for teams. Savvo optimizes for a single thing instead:
            how fast one founder can capture what happened after a pitch. You type &quot;Marcus at Founders Fund passed, too early,
            revisit at Series A&quot; and it becomes structured contact context, a health score, and a place in tomorrow&apos;s digest.
          </p>
          <ComparisonTable
            competitor="Attio"
            rows={[
              { dimension: "Built for", them: "Go-to-market teams scaling from startup to IPO", savvo: "A solo founder running a raise, then their network after it closes" },
              { dimension: "Setup time", them: "Configure objects, attributes, views, and pipelines to fit your workflow", savvo: "Sign up and type your first note. Investor tracking is the default" },
              { dimension: "Data entry after each pitch", them: "Update records and pipeline stages; email and calendar sync fill in some of it", savvo: "Type one messy sentence. AI extracts name, firm, role, and next step" },
              { dimension: "Follow-up reminders", them: "Tasks and automations you configure", savvo: "Daily digest email plus per-contact cadences and snooze, on by default" },
              { dimension: "Relationship health", them: "Attributes and reports you build to track engagement", savvo: "Automatic color-coded health scores on every contact" },
              { dimension: "Search", them: "Structured filtering and views over your records", savvo: "Semantic search: \"which investors cared about healthcare AI?\"" },
              { dimension: "Price for one founder", them: "Free plan for up to 3 users; Plus from around $29/user/month billed annually", savvo: "Free for 50 contacts; Pro $8/month or $75/year" },
              { dimension: "Learning curve", them: "Real: powerful data model that rewards time invested in it", savvo: "Minimal: type notes, read the morning digest" },
            ]}
          />
          <p className="text-xs text-stone-700 dark:text-stone-300 mt-3 text-center">
            Attio pricing changes; check <a href="https://attio.com/pricing" className="underline hover:text-[var(--copper-text)]" rel="nofollow">attio.com/pricing</a> for current numbers.
          </p>
        </section>

        {/* When Attio is better */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">When Attio is the better choice</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-8 max-w-lg mx-auto">Attio is excellent software. Choose it if these describe where you are.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "You're building a full go-to-market CRM", desc: "If the raise is closing and you are about to run a real sales motion, Attio's custom objects, pipelines, and reporting are what you will grow into. Savvo will never be a sales team's system of record." },
              { title: "Your team is already collaborating in it", desc: "Attio's free plan supports up to 3 users, and its whole design assumes shared workflows. Savvo is single-player today, with a team plan still on the roadmap." },
              { title: "You want automatic enrichment", desc: "Attio syncs and enriches contacts from your email and calendar automatically. If you want records that fill themselves from your communication data, that is a genuine Attio strength." },
              { title: "You want your CRM to be infrastructure", desc: "API access, integrations, custom objects: Attio is a platform other tools build on. If you are wiring your CRM into a larger stack, it is the more capable foundation." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border bg-white dark:bg-stone-800 p-5 shadow-refined">
                <h3 className="text-sm font-semibold mb-2 text-stone-900 dark:text-stone-100">{item.title}</h3>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-stone-700 dark:text-stone-300 text-center mt-8 max-w-2xl mx-auto leading-relaxed">
            The question is sequencing. During the raise itself, the bottleneck is capture and follow-through, not data modeling.
            Plenty of founders run the raise in Savvo and adopt a team CRM like Attio when they hire their first seller.
          </p>
        </section>

        {/* FAQ */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-8">Common questions</h2>
          <VsFaq
            items={[
              {
                q: "Can I import my Attio data into Savvo?",
                a: "Yes. Export your people or companies from Attio as a CSV and upload it to Savvo. Columns map to name, firm, email, and notes, duplicates are detected and skipped, and health scores generate automatically on import. CSV import is a Pro feature ($8/month).",
              },
              {
                q: "Isn't Attio free for small teams anyway?",
                a: "Yes, Attio has a genuinely useful free plan for up to 3 users, and if what you want is a configurable team CRM at no cost, it is a strong option. The tradeoff is not price, it is time: Attio asks you to design your workflow, while Savvo ships with the fundraising workflow built in and captures updates from a single typed sentence.",
              },
              {
                q: "Can Savvo grow with my company after the raise?",
                a: "Savvo keeps working after the round closes as your personal relationship system: investors, hires, board members, customers, and your broader network, with the same health scores and digests. A team plan with a shared contact graph is planned, but today Savvo is honest about being a single-player tool. If you need multi-seat pipelines now, Attio fits better.",
              },
            ]}
          />
        </section>

        {/* Final CTA */}
        <section className="py-12 sm:py-20 text-center">
          <h2 className="text-3xl tracking-tight mb-3">
            Configure a CRM later.<br />
            <span className="text-[var(--copper-text)]">Close the round now.</span>
          </h2>
          <p className="text-stone-700 dark:text-stone-300 mb-6 max-w-md mx-auto">
            Start free with 50 contacts. Your first investor note takes ten seconds to add.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
          >
            Get Started Free
          </Link>
        </section>

        <MoreComparisons current="/vs/attio" />
      </main>

      <VsFooter />
    </div>
  )
}
