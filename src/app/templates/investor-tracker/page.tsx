import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Free Investor Pipeline Tracker Template",
  description:
    "A free investor pipeline tracker template (CSV) for founders raising a round. Eleven useful columns, 8 practical pipeline stages, and concrete follow-up guidance.",
  alternates: { canonical: "/templates/investor-tracker" },
  openGraph: {
    title: "Free Investor Pipeline Tracker Template | Savvo",
    description:
      "Download a free investor tracker spreadsheet template for your fundraise. No email required. Then import it into Savvo when the spreadsheet stops scaling.",
    url: "/templates/investor-tracker",
  },
}

const columns = [
  { name: "Investor Name", why: "One row per person, not per firm. You raise from people." },
  { name: "Firm", why: "The fund or angel group. Helps you avoid double-pitching partners at the same firm." },
  { name: "Role", why: "GP, Partner, Principal, Angel. This helps you distinguish decision-makers from champions and other useful contacts." },
  { name: "Check Size Range", why: "So you can tell at a glance whether your round math works with the investors still live." },
  { name: "Stage Focus", why: "Pre-seed, seed, Series A. Filters out polite meetings that were never going to convert." },
  { name: "Intro Path", why: "Who made the intro. You will need this to send updates and thank-yous, and to ask for more intros." },
  { name: "Status", why: "The pipeline stage. This is the column you sort by every morning." },
  { name: "Last Contact Date", why: "Silence makes an active thread easy to lose. Track the latest touchpoint so stale conversations are visible." },
  { name: "Next Step", why: "A concrete action with an owner: send deck, intro to customer, schedule partner meeting." },
  { name: "Next Step Date", why: "A next step without a date is a wish. Give every action a deadline." },
  { name: "Notes", why: "What they asked, what they doubted, who they know. Gold for the second meeting." },
]

const stages = [
  { stage: "Researching", meaning: "You have identified them but have not reached out yet." },
  { stage: "Intro Requested", meaning: "You asked a mutual connection for an intro. Waiting." },
  { stage: "Intro Made", meaning: "The intro email is out. Your job: reply fast and book the call." },
  { stage: "First Meeting", meaning: "The pitch happened. Record questions, concerns, and the agreed next action." },
  { stage: "Partner Meeting", meaning: "You are meeting more of the partnership or the relevant decision-makers." },
  { stage: "Diligence", meaning: "They are checking references, metrics, and the data room." },
  { stage: "Committed", meaning: "Verbal or signed. Get the documents moving." },
  { stage: "Passed", meaning: "A no. Log why. Passes with reasons are useful data for the next raise." },
]

const tips = [
  {
    title: "The 48-hour rule",
    body: "Aim to follow up within 48 hours of an investor meeting. Send a short recap, answer any open question, and propose the next step while the conversation is still fresh.",
  },
  {
    title: "Batch your outreach into waves",
    body: "One workable approach is to run outreach in waves of 8 to 12 instead of emailing the whole list at once. Start with investors whose feedback can sharpen the pitch, then apply what you learn before contacting top targets.",
  },
  {
    title: "Track who made each intro",
    body: "That Intro Path column is not decoration. When an investor commits or passes, close the loop with the person who introduced you. It respects their effort, keeps them informed, and gives you a natural place to ask for another relevant introduction.",
  },
  {
    title: "Never let a warm intro sit for more than a week",
    body: "A warm intro deserves a prompt response. If nothing is scheduled within 7 days, consider one concise nudge with two specific times. Make the next action easy to accept or decline.",
  },
]

export default function InvestorTrackerTemplatePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/85 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/logo.svg" alt="Savvo" className="h-7 w-7" />
            <span className="text-xl font-medium tracking-tight text-[var(--copper-text)] group-hover:opacity-80 transition-opacity">Savvo</span>
          </Link>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-4xl">
        {/* Hero */}
        <section className="py-12 sm:py-20 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--copper)]/10 text-[var(--copper-text)] text-xs font-medium mb-6">
            📥 Free template, no email required
          </div>
          <h1 className="text-3xl sm:text-5xl font-normal tracking-tight mb-4 leading-tight">
            Free investor pipeline<br />
            <span className="text-[var(--copper-text)]">tracker template</span>
          </h1>
          <p className="text-stone-700 dark:text-stone-300 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            A fundraise is a pipeline, and it is easy to run too much of it from memory. This free CSV template gives you
            eleven useful columns and eight practical stages for organizing investor conversations. Download it, open it in
            Google Sheets or Excel, and start tracking your raise today. No email gate, no signup.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/templates/investor-pipeline-tracker.csv"
              download="investor-pipeline-tracker.csv"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
            >
              Download the Template (CSV)
            </a>
            <a
              href="#how-to-use"
              className="inline-flex items-center justify-center px-6 py-4 rounded-xl text-base font-medium border hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
            >
              See What&apos;s Inside
            </a>
          </div>
          <p className="text-xs text-stone-700 dark:text-stone-300 mt-3">Works in Google Sheets, Excel, Numbers, and Notion. Includes 3 example rows.</p>
        </section>

        {/* How to use: columns */}
        <section id="how-to-use" className="py-12 sm:py-16 scroll-mt-20">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">How to use it: the columns</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-10 max-w-lg mx-auto">
            Eleven columns. Each one earns its place, and each one answers a question you will actually ask mid-raise.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {columns.map((col, i) => (
              <div key={i} className="rounded-xl border bg-white dark:bg-stone-800 p-5 shadow-refined">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1.5">{col.name}</h3>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{col.why}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Status stages */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">The 8 pipeline stages</h2>
          <p className="text-stone-700 dark:text-stone-300 text-center mb-10 max-w-lg mx-auto">
            Give each investor one current stage, then sort by Status during your review. Use the stage and Next Step Date
            together to decide which action needs attention first.
          </p>
          <div className="rounded-2xl border bg-white dark:bg-stone-800 shadow-refined overflow-hidden">
            <ol className="divide-y divide-stone-200 dark:divide-stone-700">
              {stages.map((s, i) => (
                <li key={i} className="flex items-start gap-4 p-4 sm:px-6">
                  <span className="w-7 h-7 rounded-full bg-[var(--copper)]/10 flex items-center justify-center shrink-0 mt-0.5 text-xs text-[var(--copper-text)] font-semibold">{i + 1}</span>
                  <div>
                    <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{s.stage}</span>
                    <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{s.meaning}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Tactical tips */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-10">Four practical follow-up habits</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {tips.map((tip, i) => (
              <div key={i} className="rounded-xl border bg-white dark:bg-stone-800 p-6 shadow-refined">
                <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-2">{tip.title}</h3>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{tip.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Honest pivot */}
        <section className="py-12 sm:py-16">
          <div className="rounded-2xl border-2 border-[var(--copper)]/40 bg-white dark:bg-stone-800 p-8 sm:p-10 shadow-refined-lg text-center">
            <h2 className="text-2xl sm:text-3xl tracking-tight mb-4">
              Honest note: <span className="text-[var(--copper-text)]">spreadsheets get harder to maintain at scale</span>
            </h2>
            <p className="text-stone-700 dark:text-stone-300 max-w-2xl mx-auto leading-relaxed mb-4">
              This template is a practical starting point. As the number of conversations grows, the tradeoffs become
              more noticeable: the sheet does not remind you when a thread goes quiet, natural-language search is not
              built in, and every Next Step Date still depends on a manual review.
            </p>
            <p className="text-stone-700 dark:text-stone-300 max-w-2xl mx-auto leading-relaxed mb-8">
              Savvo imports this exact CSV. It maps the contact, context, and follow-up columns, and brings Status over
              as each investor&apos;s raise stage, so your pipeline arrives intact. Every imported investor gets a health
              score, reminders when the relationship goes cold, and searchable notes. The free plan imports up to 50
              investors.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
              >
                Import This CSV Into Savvo
              </Link>
              <Link
                href="/from-spreadsheet"
                className="inline-flex items-center justify-center px-6 py-4 rounded-xl text-base font-medium border hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
              >
                Why Spreadsheets Stop Working
              </Link>
            </div>
          </div>
        </section>

        {/* Related pages */}
        <section className="py-8 sm:py-12 text-center">
          <p className="text-sm text-stone-700 dark:text-stone-300">
            Comparing tools for your raise? See{" "}
            <Link href="/vs/airtable" className="text-[var(--copper-text)] hover:opacity-80 font-medium">Savvo vs Airtable</Link>,{" "}
            <Link href="/vs/notion" className="text-[var(--copper-text)] hover:opacity-80 font-medium">Savvo vs Notion</Link>, or
            read more fundraising tactics on the{" "}
            <Link href="/blog" className="text-[var(--copper-text)] hover:opacity-80 font-medium">Savvo blog</Link>.
          </p>
        </section>
      </main>

      <footer className="py-8 px-6 border-t text-center text-sm text-stone-700 dark:text-stone-300 space-y-2">
        <p>&copy; 2026 Savvo. Built for people who care about people.</p>
        <p>
          <Link href="/" className="hover:text-foreground font-medium">Home</Link>
          {" "}&middot;{" "}
          <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          {" "}&middot;{" "}
          <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
        </p>
      </footer>
    </div>
  )
}
