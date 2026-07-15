import Link from "next/link"
import type { Metadata } from "next"
import { VsHeader, VsFooter, ComparisonTable, VsFaq, MoreComparisons } from "../shared"

export const metadata: Metadata = {
  title: "Savvo vs Streak CRM for Fundraising",
  description: "Looking for a Streak CRM alternative for fundraising? Compare Streak's Gmail pipelines with Savvo, the $8/month investor CRM built for solo founders.",
  alternates: { canonical: "/vs/streak" },
  openGraph: {
    title: "Savvo vs Streak CRM for Fundraising",
    description: "Streak puts sales pipelines inside Gmail at sales-team prices. Savvo tracks your whole raise, including everything that happens off email.",
    url: "/vs/streak",
  },
}

export default function VsStreakPage() {
  return (
    <div className="min-h-screen bg-background">
      <VsHeader />

      <main className="container mx-auto px-4 max-w-4xl">
        {/* Hero */}
        <section className="py-12 sm:py-20 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] text-xs font-medium mb-6">
            Savvo vs Streak
          </div>
          <h1 className="text-3xl sm:text-5xl font-normal tracking-tight mb-4 leading-tight">
            Your raise doesn&apos;t happen<br />
            <span className="text-[var(--copper)]">only in your inbox</span>
          </h1>
          <p className="text-stone-700 dark:text-stone-300 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Streak turns Gmail into a sales pipeline, and it does that well. But fundraising is not a sales pipeline that lives in
            email. It is a hallway intro at a demo day, a text from an angel, a coffee that went long. If the conversation never
            touched your inbox, a Gmail CRM never sees it.
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
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">A sales tool at sales-team prices</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            Streak&apos;s positioning is managing sales and customer relationships directly inside Gmail, and for teams running
            shared pipelines on Google Workspace it is a strong product. The friction for a solo founder is twofold. First,
            price: Streak&apos;s free tier now covers email power tools like tracking and mail merge, while full CRM pipelines
            start at roughly $49 per user per month, sales-team pricing for a one-person raise. Second, capture: Streak
            organizes email threads into boxes, but investor conversations that happen in person, over text, or through a
            warm intro have no thread to attach to. Savvo starts from the note instead: type what you remember from any
            conversation, wherever it happened, and AI structures it.
          </p>
          <ComparisonTable
            competitor="Streak"
            rows={[
              { dimension: "Where it lives", them: "Inside Gmail, as a browser extension and sidebar", savvo: "Standalone web app, installable on your phone's home screen" },
              { dimension: "Data entry after each pitch", them: "Attach email threads to pipeline boxes, update stage fields", savvo: "Type one messy sentence. AI extracts name, firm, role, and next step" },
              { dimension: "Meetings that happen off email", them: "Manual entry, no thread to anchor them to", savvo: "Same natural-language capture; calendar sync also detects 1:1 meetings" },
              { dimension: "Follow-up reminders", them: "Tasks and snoozed threads you set per box", savvo: "Daily digest email plus cadences: weekly, monthly, quarterly, or custom per contact" },
              { dimension: "Relationship health", them: "Pipeline stages you move manually", savvo: "Automatic color-coded health scores, green to red, based on real activity" },
              { dimension: "Search", them: "Gmail search plus pipeline filters", savvo: "Semantic search across your whole network: \"which angels liked the product?\"" },
              { dimension: "Price for one founder", them: "Free email tools; full CRM pipelines from around $49/user/month", savvo: "Free for 50 contacts; Pro $8/month or $75/year" },
              { dimension: "Learning curve", them: "Moderate: pipelines, boxes, stages, and magic columns", savvo: "Minimal: type notes, read the morning digest" },
            ]}
          />
          <p className="text-xs text-stone-700 dark:text-stone-300 mt-3 text-center">
            Streak pricing changes; check <a href="https://www.streak.com/pricing" className="underline hover:text-[var(--copper)]" rel="nofollow">streak.com/pricing</a> for current numbers.
          </p>
        </section>

        {/* When Streak is better */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">When Streak is the better choice</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-8 max-w-lg mx-auto">Streak earns its place in plenty of stacks. Choose it if these fit you.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "You live in Gmail", desc: "If every investor conversation genuinely runs through email and you never want to open another tab, a pipeline inside the inbox is hard to beat. That is Streak's whole thesis, and it delivers on it." },
              { title: "Your team runs shared pipelines", desc: "Streak is built for teams on Google Workspace sharing pipelines, with roles and permissions. Savvo is built for an individual today; its team plan is still coming." },
              { title: "You need heavy email outreach", desc: "Mail merge, email tracking, and snippets are core Streak features. If your raise involves high-volume cold outreach from Gmail, Streak's email tooling is genuinely stronger." },
              { title: "Email threads are your source of truth", desc: "Streak attaches CRM data directly to threads, so the full correspondence history lives with each deal. If that anchoring matters more to you than off-email capture, pick Streak." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border bg-white dark:bg-stone-800 p-5 shadow-refined">
                <h3 className="text-sm font-semibold mb-2 text-stone-900 dark:text-stone-100">{item.title}</h3>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-stone-700 dark:text-stone-300 text-center mt-8 max-w-2xl mx-auto leading-relaxed">
            For a solo founder, the honest math is simpler: most raises are one person tracking 40 to 80 investor conversations
            across email, events, and intros. That is a relationship problem, not an inbox problem.
          </p>
        </section>

        {/* FAQ */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-8">Common questions</h2>
          <VsFaq
            items={[
              {
                q: "Can I move my Streak pipeline into Savvo?",
                a: "Yes. Export your Streak pipeline to a CSV (or via Google Sheets), then upload it to Savvo. Column mapping handles names, firms, emails, and notes, duplicates are skipped automatically, and every contact gets a health score on import. CSV import is a Pro feature ($8/month).",
              },
              {
                q: "Does Savvo integrate with Gmail?",
                a: "Partly, and it is worth being precise: Savvo imports Google Contacts and syncs with Google Calendar to detect 1:1 meetings, but it does not live inside your inbox or track email opens the way Streak does. If in-inbox email tooling is your top requirement, Streak is the better fit.",
              },
              {
                q: "Isn't Streak's free plan enough for a raise?",
                a: "Streak's free tier currently covers email power tools like tracking, snippets, and limited mail merge rather than full CRM pipelines, which sit in the paid plans. Savvo's free plan includes actual investor tracking: 50 contacts, natural-language capture, health scores, and weekly digest emails.",
              },
            ]}
          />
        </section>

        {/* Final CTA */}
        <section className="py-12 sm:py-20 text-center">
          <h2 className="text-3xl tracking-tight mb-3">
            Track every investor conversation.<br />
            <span className="text-[var(--copper)]">Not just the ones in your inbox.</span>
          </h2>
          <p className="text-stone-700 dark:text-stone-300 mb-6 max-w-md mx-auto">
            Start free with 50 contacts. Type what you remember after your next pitch, wherever it happened.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
          >
            Get Started Free
          </Link>
        </section>

        <MoreComparisons current="/vs/streak" />
      </main>

      <VsFooter />
    </div>
  )
}
