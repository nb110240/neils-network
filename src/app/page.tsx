import type { Metadata } from "next"
import Link from "next/link"
import { TypingDemo } from "@/components/typing-demo"

// Title and description are inherited from the root layout (the homepage keeps
// the site-wide default title). Only the canonical URL is set here.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

// The homepage is a fully static marketing page (prerendered, served from the
// CDN) so logged-out visitors get an instant load with no serverless cold
// start. Logged-in users are redirected to /dashboard by the middleware before
// this renders, which keeps the auth check off the anonymous, conversion-
// critical path and lets this route prerender statically (no cookies()/getUser).
export default function Home() {
  return <MarketingPage />
}

// ─── Logged-out users: Marketing Page ───

function MarketingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <nav aria-label="Primary" className="fixed top-0 left-0 right-0 z-50 border-b bg-background/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <span className="flex items-center gap-2"><img src="/logo.svg" alt="" className="h-6 w-6" /><span className="text-xl font-medium tracking-tight text-[var(--copper-text)]">Savvo</span></span>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Features</Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</Link>
            <Link href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">FAQ</Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Privacy</Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Log in</Link>
            <Link href="/login?mode=signup" className="inline-flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>

      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-[var(--copper-text)] mb-4">Raise autopilot for founder-led fundraising</p>
            <h1 className="text-4xl sm:text-5xl leading-[1.08] tracking-tight mb-4">
              Turn every investor conversation into the <em className="not-italic text-[var(--copper-text)]">right next move</em>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-md">
              Paste meeting notes or import them from your calendar and Granola. Savvo finds promises, drafts the follow-up, and ranks your Next 3 Moves. You approve every change.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/login?mode=signup" className="inline-flex items-center px-6 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
                Create your first move
              </Link>
              <Link href="#how" className="inline-flex items-center px-6 py-3 rounded-xl text-base font-medium border border-border hover:border-[var(--copper)]/30 transition-colors">
                See the 10-minute setup
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4 max-w-md">
              Start with one real investor conversation. No dashboard setup, no generic chat, and no message is ever sent for you.
            </p>
            <Link href="/from-spreadsheet" className="inline-flex items-center gap-2 mt-3 py-1 text-sm text-muted-foreground hover:text-[var(--copper-text)] transition-colors group">
              <span>📋</span>
              <span className="underline underline-offset-2 decoration-stone-300 group-hover:decoration-[var(--copper)]">Using a spreadsheet? See how to import</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
          <div className="relative mt-4 md:mt-0">
            <div className="rounded-2xl border shadow-refined-lg p-6 rotate-1">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--copper-text)]">After-call review</div>
                  <div className="mt-1 font-semibold">Seed investor meeting</div>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Needs approval</span>
              </div>
              <div className="space-y-3 border-y py-4 text-sm">
                <div><p className="text-xs text-muted-foreground">You promised</p><p className="font-medium">Send cohort analysis by Friday</p></div>
                <div><p className="text-xs text-muted-foreground">They promised</p><p className="font-medium">Introduce you to the fintech partner</p></div>
                <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Follow-up draft</p><p className="mt-1 text-stone-700 dark:text-stone-300">Thanks for the thoughtful churn questions. I&apos;ll send the cohort view Friday.</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Nothing changes until you approve.</span>
                <span className="rounded-lg bg-[var(--copper)] px-3 py-2 text-xs font-semibold text-white">Review</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card/50" id="how">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper-text)] mb-2">How it works</p>
          <h2 className="text-3xl tracking-tight mb-3">A real next action in under 10 minutes</h2>
          <p className="text-muted-foreground mb-10 max-w-lg">Use context you already have. Paste one note, import your spreadsheet, or connect your calendar.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: "01", title: "Bring one real interaction", desc: "Paste a meeting note, import your investor spreadsheet, or connect Calendar or Granola.", example: '"Maya asked about churn. I promised to send cohorts Friday. She will introduce her fintech partner."' },
              { num: "02", title: "Approve what matters", desc: "Savvo proposes contact updates, commitments, and a follow-up. Edit or reject anything before it reaches your CRM." },
              { num: "03", title: "Work your Next 3 Moves", desc: "Overdue promises, reviews, warm intros, and waiting-on-them actions are ranked in one explainable list." },
            ].map((step) => (
              <div key={step.num}>
                <span aria-hidden="true" className="text-4xl font-normal text-stone-500 dark:text-stone-400 block mb-1">{step.num}</span>
                <h3 className="text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                {step.example && (
                  <div className="mt-3 p-3 bg-background rounded-lg text-sm text-muted-foreground italic border-l-3 border-[var(--copper)]">
                    {step.example}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* See it in action — moved before Trust and Features */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper-text)] mb-2">See it in action</p>
          <h2 className="text-3xl tracking-tight mb-3">What the app actually looks like</h2>
          <p className="text-muted-foreground mb-10 max-w-lg">No guessing. Here&apos;s what you&apos;ll use every day.</p>

          {/* Row 1: Dashboard + Add Contact */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Dashboard mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dashboard</h3>
                <span className="text-xs text-muted-foreground">Your daily view</span>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Contacts</p><p className="text-xl font-normal">47</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Reach Out</p><p className="text-xl font-normal text-[var(--copper-text)]">5</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Going Cold</p><p className="text-xl font-normal text-red-500">3</p></div>
                </div>
                <div className="rounded-lg border-l-2 border-l-[var(--copper)] p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">REACH OUT TODAY</p>
                  {[
                    { name: "Sarah Chen", info: "Sequoia · 2 months ago", color: "bg-orange-500" },
                    { name: "Marcus Webb", info: "Follow-up needed", color: "bg-amber-400" },
                    { name: "Priya Patel", info: "Founder, Lumina · 3 months ago", color: "bg-red-500" },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${c.color}`} />
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{c.info}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-1">Every morning, Savvo tells you exactly who needs attention, prioritized by urgency so you always know where to start.</p>
              </div>
            </div>

            {/* Add contact — interactive typing demo */}
            <TypingDemo />
          </div>

          {/* Row 2: Contact Detail + Search */}
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            {/* Contact detail mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact Detail</h3>
                <span className="text-xs text-muted-foreground">Everything about a person in one place</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--copper)]/10 flex items-center justify-center text-[var(--copper-text)] font-semibold text-sm">SC</div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">Sarah Chen <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-700 text-white"><span className="w-1 h-1 rounded-full bg-white" />Going cold</span></div>
                    <div className="text-xs text-muted-foreground">Partner at Sequoia</div>
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">ACTIVITY TIMELINE</p>
                  <div className="flex gap-2 items-start">
                    <span className="w-2 h-2 rounded-full bg-[var(--copper)] mt-1.5 shrink-0" />
                    <div><span className="text-xs text-muted-foreground">Jan 15 · Meeting</span><p className="text-sm">Grabbed coffee, discussed AI CRM landscape. She&apos;s interested in early-stage tools.</p></div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div><span className="text-xs text-muted-foreground">Jan 10 · Email</span><p className="text-sm">Sent intro email after Founders Dinner.</p></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs px-2 py-1 rounded-md border bg-muted/50">&#x1f4ac; Draft Follow-Up</span>
                  <span className="text-xs px-2 py-1 rounded-md border bg-muted/50">&#x1f4c5; Meeting Prep</span>
                  <span className="text-xs px-2 py-1 rounded-md border bg-muted/50">&#x270f;&#xfe0f; Edit</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">See the full history, log interactions, and draft AI-powered follow-ups, all from one screen.</p>
              </div>
            </div>

            {/* Smart search mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Smart Search</h3>
                <span className="text-xs text-muted-foreground">Find people by meaning, not keywords</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border p-3 text-sm flex items-center gap-2">
                  <span className="text-muted-foreground">&#128269;</span>
                  <span className="italic text-muted-foreground">&ldquo;who do I know in healthcare AI?&rdquo;</span>
                </div>
                <p className="text-xs text-muted-foreground">3 results</p>
                {[
                  { name: "Dr. Amy Liu", role: "Chief Medical Officer, HealthBridge AI", match: "92%" },
                  { name: "James Torres", role: "ML Engineer, Tempus", match: "87%" },
                  { name: "Nina Shah", role: "Founder, MedFlow", match: "81%" },
                ].map((r) => (
                  <div key={r.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-sm">
                    <div>
                      <span className="font-medium">{r.name}</span>
                      <p className="text-xs text-muted-foreground">{r.role}</p>
                    </div>
                    <span className="text-xs text-[var(--copper-text)] font-medium">{r.match} match</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">Ask natural questions about your network. Savvo searches by meaning, not just names and keywords.</p>
              </div>
            </div>
          </div>

          {/* Row 3: Daily Digest + Intro Suggestions */}
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            {/* Daily Digest Email mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Daily Digest Email</h3>
                <span className="text-xs text-muted-foreground">Lands in your inbox every morning</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="font-medium mb-2">Hey Neil, 3 relationships need your attention:</p>
                  {[
                    { name: "Sarah Chen", context: "You met at Founders Dinner · Last contact: 2 months ago", color: "bg-orange-500" },
                    { name: "Marcus Webb", context: "Has a follow-up pending · Next step: Review proposal", color: "bg-amber-400" },
                    { name: "Priya Patel", context: "Founder at Lumina · Last contact: 3 months ago", color: "bg-red-500" },
                  ].map((c) => (
                    <div key={c.name} className="flex items-start gap-2 py-2 border-t first:border-t-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.color} mt-1.5 shrink-0`} />
                      <div>
                        <span className="font-medium text-sm">{c.name}</span>
                        <p className="text-xs text-muted-foreground">{c.context}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">No app to open. No tasks to check. Just read your email, tap a name, and reconnect. Pro users get this every morning.</p>
              </div>
            </div>

            {/* Import from Spreadsheet mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Import from Spreadsheet</h3>
                <span className="text-xs text-muted-foreground">Bring your existing network</span>
              </div>
              <div className="space-y-3">
                {/* CSV upload area */}
                <div className="rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 p-4 text-center">
                  <div className="w-8 h-8 rounded-lg bg-[var(--copper)]/10 flex items-center justify-center mx-auto mb-2">
                    <span className="text-[var(--copper-text)] text-sm">&#x1f4ce;</span>
                  </div>
                  <p className="text-xs font-medium">contacts.csv</p>
                  <p className="text-[10px] text-muted-foreground">47 rows detected</p>
                </div>

                {/* Column mapping */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">COLUMN MAPPING</p>
                  {[
                    { csv: "Full Name", savvo: "Name", status: "mapped" },
                    { csv: "Organization", savvo: "Company", status: "mapped" },
                    { csv: "Email Address", savvo: "Email", status: "mapped" },
                    { csv: "Notes", savvo: "Raw Note", status: "mapped" },
                    { csv: "Phone", savvo: "Phone", status: "mapped" },
                  ].map((col) => (
                    <div key={col.csv} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{col.csv}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{col.savvo}</span>
                      <span className="text-green-600 text-[10px]">&#10003;</span>
                    </div>
                  ))}
                </div>

                {/* Success state */}
                <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3 text-center">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">&#10003; 47 contacts imported</p>
                  <p className="text-xs text-green-800 dark:text-green-300">3 duplicates skipped · Health scores generating...</p>
                </div>

                <p className="text-xs text-muted-foreground pt-1">Upload any CSV or connect Google Contacts. Savvo maps your columns, deduplicates, and generates health scores automatically. <Link href="/from-spreadsheet" className="text-[var(--copper-text)] hover:underline font-medium">Learn more →</Link></p>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/login?mode=signup" className="inline-flex items-center px-6 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
              Try it yourself for free
            </Link>
            <p className="text-sm text-muted-foreground mt-3">No credit card required. Free plan, no strings attached.</p>
          </div>
        </div>
      </section>

      {/* Privacy & Trust */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper-text)] mb-2">Your data, your control</p>
          <h2 className="text-3xl tracking-tight mb-10">Built for trust</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-lg">&#128274;</div>
              <div>
                <h3 className="font-medium mb-1">We never sell your data</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Your contacts are yours. We never sell them or show them to other users. AI providers only process data for features you choose.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-lg">&#9889;</div>
              <div>
                <h3 className="font-medium mb-1">Everything is optional</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Calendar, Granola, email forwarding, and imports are opt-in. AI proposals wait in Review Inbox, and Savvo never sends a message for you.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-lg">&#128220;</div>
              <div>
                <h3 className="font-medium mb-1">Export anytime</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Download contacts as CSV or export your full Savvo data as JSON. Delete meeting text or your whole account whenever you choose.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 sm:py-20 px-4 sm:px-6" id="features">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper-text)] mb-2">Features</p>
          <h2 className="text-3xl tracking-tight mb-10">Everything your raise needs next</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: "Commitment Engine", desc: "Separate what you promised from what the investor promised, with evidence and due dates." },
              { title: "Next 3 Moves", desc: "An explainable priority list across commitments, approvals, follow-ups, and warm introductions." },
              { title: "Approval Inbox", desc: "Review and edit every AI proposal before it updates a contact or creates an action." },
              { title: "Calendar & Granola", desc: "Bring in event descriptions, summaries, and transcripts without building another recorder." },
              { title: "Sourced Investor Research", desc: "Separate your CRM facts from current public research with time stamps and clickable citations." },
              { title: "Warm Intro Pipeline", desc: "Find evidence-backed connectors, prepare the ask, and track it through meeting booked." },
              { title: "Free CSV Import", desc: "Import up to 50 contacts from any spreadsheet free, or use Pro for unlimited CSV and Google Contacts import." },
              { title: "Private by Default", desc: "Nothing changes and nothing sends until you explicitly approve or copy it." },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-xl border hover:border-[var(--copper)]/30 hover:shadow-refined transition-all">
                <h3 className="text-base font-medium mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card/50" id="pricing">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper-text)] mb-2">Pricing</p>
          <h2 className="text-3xl tracking-tight mb-2">Start free. Upgrade when you need more.</h2>
          <p className="text-muted-foreground mb-10">No credit card required.</p>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="p-6 rounded-2xl border">
              <div className="font-semibold mb-1">Free</div>
              <div className="text-3xl font-normal mb-1">$0 <span className="text-base text-muted-foreground font-normal">/month</span></div>
              <p className="text-sm text-muted-foreground mb-4">For getting started</p>
              <ul className="space-y-2 text-sm mb-6">
                {["50 contacts", "3 AI meeting reviews", "CSV import (up to 50)", "Next 3 Moves", "5 smart searches / month", "Weekly digest emails"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-emerald-500 font-bold">&#10003;</span> {f}</li>
                ))}
                {["Unlimited import", "Google Calendar sync", "Granola ingestion", "Daily digest emails"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-stone-700 dark:text-stone-300"><span className="font-bold">&#10007;</span> {f}</li>
                ))}
              </ul>
              <Link href="/login?mode=signup" className="block text-center py-2.5 rounded-lg border font-medium text-sm hover:bg-muted/50 transition-colors">Get started</Link>
            </div>
            <div className="p-6 rounded-2xl border border-[var(--copper)]/30 relative">
              <div className="absolute -top-3 right-4 bg-[var(--copper)] text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full">Most popular</div>
              <div className="font-semibold mb-1">Pro</div>
              <div className="text-3xl font-normal mb-1">$8 <span className="text-base text-muted-foreground font-normal">/month</span></div>
              <p className="text-sm text-stone-700 dark:text-stone-300 mb-4">or $75/year</p>
              <ul className="space-y-2 text-sm mb-6">
                {["Unlimited contacts", "Unlimited meeting reviews", "Commitment Engine and Next 3 Moves", "Sourced investor research", "Warm intro pipeline", "Unlimited CSV and Google import", "Calendar and Granola ingestion", "Daily digest emails"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-emerald-500 font-bold">&#10003;</span> {f}</li>
                ))}
              </ul>
              <Link href="/login?mode=signup" className="block text-center py-2.5 rounded-lg bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white font-medium text-sm hover:opacity-90 transition-opacity">Start free, upgrade anytime</Link>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Team workflows will come later. Savvo is focused first on making one founder&apos;s raise execution exceptional.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-12 sm:py-20 px-4 sm:px-6 max-w-3xl mx-auto">
        <h2 className="text-3xl tracking-tight text-center mb-10">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            {
              q: "What is Savvo?",
              a: "Savvo is an AI-powered personal CRM built for founders, VCs, and professional networkers. You add contacts by typing what you remember about someone, like messy meeting notes, and Savvo automatically extracts their name, company, role, and follow-up actions. Every contact gets a health score that tracks how fresh the relationship is, and you get daily digest emails reminding you who needs attention.",
            },
            {
              q: "How does the health score work?",
              a: "Every contact gets a color-coded health score based on when you last interacted. Green means active (within the last 30 days), yellow means cooling (31-90 days), orange means going cold (91-180 days), and red means at risk (180+ days). Your dashboard shows you exactly who needs a reach-out, prioritized by urgency.",
            },
            {
              q: "Is my data private and secure?",
              a: "Yes. Savvo uses Supabase with PostgreSQL and row-level security, so every user can only access their own data. All data is encrypted in transit (HTTPS) and at rest. We never sell your data or share contacts with other users, and you can export or delete everything at any time. AI providers process data only for features you choose. OpenAI API inputs and outputs are not used to train OpenAI models by default.",
            },
            {
              q: "How is Savvo different from a spreadsheet or Notion?",
              a: "Spreadsheets and Notion require you to manually create columns, type structured data, and remember to check them. Savvo lets you type naturally, for example, 'Met Sarah at TechCrunch, she runs a fintech startup,' and AI handles the structure. Plus, you get automatic health scores, follow-up reminders via daily digest emails, and semantic search so you can find people by context, not just names.",
            },
            {
              q: "Can I import my existing contacts?",
              a: "Yes. Pro users can import via CSV upload (works with any spreadsheet export) or connect Google Contacts for a one-click import. Savvo automatically deduplicates during import so you won't get duplicate entries. Your existing spreadsheet becomes your starting point.",
            },
            {
              q: "What does the AI actually do?",
              a: "Savvo uses AI in four ways: (1) Contact extraction parses natural language notes into structured data. (2) Semantic search finds contacts by meaning, not just keywords ('who was the fintech person?'). (3) Follow-up drafts generate personalized outreach messages based on your history. (4) Intro suggestions identify high-value introductions across your network.",
            },
            {
              q: "How much does Savvo cost?",
              a: "Savvo has a generous free plan with 50 contacts, health scores, weekly digest emails, and 5 smart searches per month. The Pro plan is $8/month (or $75/year) and includes unlimited contacts, daily digests, unlimited semantic search, AI follow-up drafts, meeting prep, intro suggestions, CSV/Google import, and Google Calendar sync.",
            },
            {
              q: "Who is Savvo built for?",
              a: "Savvo is built for people whose network is their most valuable professional asset: startup founders managing investor and partner relationships, VCs tracking portfolio founders and dealflow, community builders maintaining large networks, and sales professionals who value relationship-first selling. If you meet a lot of people and struggle to keep every connection warm, Savvo is for you.",
            },
          ].map((faq, i) => (
            <details key={i} className="group border rounded-xl px-5 py-4 bg-white/60 dark:bg-stone-900/40 shadow-refined">
              <summary className="cursor-pointer text-sm font-medium flex items-center justify-between gap-4 list-none">
                {faq.q}
                <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 text-center">
        <h2 className="text-3xl tracking-tight mb-3">Your network is your most valuable asset.<br />Keep it alive.</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">Join founders, VCs, and connectors who use Savvo to stay on top of every relationship.</p>
        <Link href="/login?mode=signup" className="inline-flex items-center px-6 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
          Get Started Free
        </Link>
      </section>

      </main>

      <footer className="py-8 px-6 border-t text-center text-sm text-muted-foreground space-y-2">
        <p>&copy; 2026 Savvo. Built for people who care about people.</p>
        <p>
          <Link href="/privacy" className="hover:text-foreground font-medium">Privacy Policy</Link>
          {" "}&middot;{" "}
          <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          {" "}&middot;{" "}
          <Link href="#faq" className="hover:text-foreground">FAQ</Link>
          {" "}&middot;{" "}
          <Link href="/from-spreadsheet" className="hover:text-foreground">Switching from Spreadsheets?</Link>
        </p>
        <p>
          <Link href="/blog" className="hover:text-foreground">Blog</Link>
          {" "}&middot;{" "}
          <Link href="/templates/investor-tracker" className="hover:text-foreground">Free Investor Tracker Template</Link>
          {" "}&middot;{" "}
          <Link href="/vs/airtable" className="hover:text-foreground">Savvo vs Airtable</Link>
          {" "}&middot;{" "}
          <Link href="/vs/notion" className="hover:text-foreground">vs Notion</Link>
          {" "}&middot;{" "}
          <Link href="/vs/attio" className="hover:text-foreground">vs Attio</Link>
          {" "}&middot;{" "}
          <Link href="/vs/streak" className="hover:text-foreground">vs Streak</Link>
        </p>
        <p className="text-xs">Your data is stored securely, never sold, and never shared with other users.</p>
      </footer>
    </div>
  )
}
