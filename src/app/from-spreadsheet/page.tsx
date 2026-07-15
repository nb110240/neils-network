import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Switching from Spreadsheets?",
  description: "Your networking Google Sheet stops working at 50 contacts. Import your spreadsheet into Savvo and get AI health scores, follow-up reminders, and semantic search.",
  alternates: { canonical: "/from-spreadsheet" },
  openGraph: {
    title: "Your Networking Spreadsheet Is Holding You Back | Savvo",
    description: "Import your contact spreadsheet into an AI-powered relationship manager. Health scores, daily digests, and semantic search, set up in minutes.",
    url: "/from-spreadsheet",
  },
}

export default function FromSpreadsheetPage() {
  const painPoints = [
    { emoji: "😰", pain: "Forgetting to follow up until it's awkward", solution: "Daily digest emails remind you exactly who needs attention" },
    { emoji: "🔍", pain: "Scrolling through 200 rows to find someone", solution: "Semantic search: \"who was that fintech person?\" just works" },
    { emoji: "📊", pain: "No way to know which relationships are going cold", solution: "Color-coded health scores on every contact, from green to red" },
    { emoji: "✍️", pain: "Typing structured data into columns after every meeting", solution: "Type messy notes, AI extracts name, company, role, and next steps" },
    { emoji: "📱", pain: "Can't check your spreadsheet on your phone at an event", solution: "Mobile-first web app for adding contacts from anywhere" },
    { emoji: "🤝", pain: "Missing introduction opportunities across your network", solution: "AI spots valuable connections and drafts the intro for you" },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/85 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/logo.svg" alt="Savvo" className="h-7 w-7" />
            <span className="text-xl font-medium tracking-tight text-[var(--copper)] group-hover:opacity-80 transition-opacity">Savvo</span>
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] text-xs font-medium mb-6">
            📋 → ✨ Import your contacts
          </div>
          <h1 className="text-3xl sm:text-5xl font-normal tracking-tight mb-4 leading-tight">
            Your networking spreadsheet<br />
            <span className="text-[var(--copper)]">stops working at 50 contacts</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            You started with a Google Sheet. It worked great for 20 contacts. Then 50. Then you started forgetting follow-ups,
            losing track of who you met where, and watching relationships go cold. Sound familiar?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
            >
              Import Your Spreadsheet Free
            </Link>
            <Link
              href="/#how"
              className="inline-flex items-center justify-center px-6 py-4 rounded-xl text-base font-medium border hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
            >
              See How It Works
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Free plan includes 50 contacts. No credit card required.</p>
        </section>

        {/* Side by side comparison */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-10">Spreadsheet vs. Savvo</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Spreadsheet column */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-6 relative">
              <div className="absolute top-4 right-4">
                <span className="px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-[10px] font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-widest">Old way</span>
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-stone-700 flex items-center justify-center shadow-sm">
                  <span className="text-lg">📋</span>
                </div>
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">Google Sheets / Notion</h3>
              </div>
              <ul className="space-y-3.5 text-sm">
                {[
                  "Manual data entry for every contact",
                  "No follow-up reminders",
                  "No idea which relationships are going cold",
                  "Search by exact name only",
                  "No context from past conversations",
                  "Breaks down after 50+ contacts",
                  "Clunky on mobile",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-600 dark:text-stone-300">
                    <span className="w-5 h-5 rounded-full bg-stone-300 dark:bg-stone-600 flex items-center justify-center shrink-0 mt-0.5 text-xs text-stone-500 dark:text-stone-400 font-medium">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Savvo column */}
            <div className="rounded-2xl border-2 border-[var(--copper)]/40 bg-white dark:bg-stone-800 p-6 shadow-refined-lg relative">
              <div className="absolute top-4 right-4">
                <span className="px-2 py-0.5 rounded-full bg-[var(--copper)]/15 text-[10px] font-bold text-[var(--copper)] uppercase tracking-widest">Better way</span>
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[var(--copper)]/10 flex items-center justify-center shadow-sm">
                  <img src="/logo.svg" alt="Savvo" className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">Savvo</h3>
              </div>
              <ul className="space-y-3.5 text-sm">
                {[
                  "Type messy notes → AI extracts the data",
                  "Daily digest: who needs attention today",
                  "Health scores: green → yellow → orange → red",
                  "Semantic search: \"fintech person at conference\"",
                  "Full history & context on every contact",
                  "Built for hundreds of connections",
                  "Mobile-first, works anywhere",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-700 dark:text-stone-200">
                    <span className="w-5 h-5 rounded-full bg-[var(--copper)]/20 flex items-center justify-center shrink-0 mt-0.5 text-xs text-[var(--copper)] font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Pain → Solution */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-3">Every spreadsheet user hits the same wall</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-lg mx-auto">Here&apos;s what breaks and how Savvo fixes it.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {painPoints.map((item, i) => (
              <div key={i} className="rounded-xl border bg-white dark:bg-stone-800 p-5 shadow-refined">
                <div className="flex items-start gap-3.5">
                  <span className="text-xl shrink-0 mt-0.5">{item.emoji}</span>
                  <div>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">{item.pain}</p>
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--copper)] shrink-0 mt-0.5 text-sm font-bold">→</span>
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{item.solution}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How import works */}
        <section className="py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl tracking-tight text-center mb-10">Import your spreadsheet in 3 steps</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Export your spreadsheet", description: "Download your Google Sheet, Excel, or Notion database as a CSV file. Any format works." },
              { step: "2", title: "Upload to Savvo", description: "Drag and drop your CSV. Map columns to contact fields such as name, company, email, and notes. Quick and painless." },
              { step: "3", title: "Watch it come alive", description: "Every contact gets a health score. AI generates embeddings for semantic search. Your daily digest starts tomorrow." },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--copper)]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[var(--copper)] font-semibold text-lg">{item.step}</span>
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-12 sm:py-20 text-center">
          <h2 className="text-3xl tracking-tight mb-3">
            Your spreadsheet got you here.<br />
            <span className="text-[var(--copper)]">Savvo takes you further.</span>
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Start free with 50 contacts. Import your spreadsheet. See the difference in one day.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity shadow-lg"
          >
            Get Started Free and Import Your Contacts
          </Link>
        </section>
      </main>

      <footer className="py-8 px-6 border-t text-center text-sm text-muted-foreground space-y-2">
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
