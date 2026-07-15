import Link from "next/link"

// Shared building blocks for the /vs/* comparison pages. These mirror the
// house pattern established by /from-spreadsheet (header, copper-gradient
// CTAs, footer with a link home) so every comparison page feels native.

export function VsHeader() {
  return (
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
  )
}

export function VsFooter() {
  return (
    <footer className="py-8 px-6 border-t text-center text-sm text-stone-700 dark:text-stone-300 space-y-2">
      <p>&copy; 2026 Savvo. Built for people who care about people.</p>
      <p>
        <Link href="/" className="hover:text-foreground font-medium">Home</Link>
        {" "}&middot;{" "}
        <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
        {" "}&middot;{" "}
        <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        {" "}&middot;{" "}
        <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
      </p>
    </footer>
  )
}

export interface ComparisonRow {
  dimension: string
  them: string
  savvo: string
}

export function ComparisonTable({ competitor, rows }: { competitor: string; rows: ComparisonRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-stone-800 shadow-refined">
      <table className="w-full text-sm border-collapse min-w-[560px]">
        <thead>
          <tr className="border-b bg-stone-50 dark:bg-stone-900/50">
            <th scope="col" className="text-left px-4 py-3.5 font-semibold text-stone-900 dark:text-stone-100 w-[28%]">What matters in a raise</th>
            <th scope="col" className="text-left px-4 py-3.5 font-semibold text-stone-900 dark:text-stone-100">{competitor}</th>
            <th scope="col" className="text-left px-4 py-3.5 font-semibold text-[var(--copper)]">Savvo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dimension} className="border-b last:border-b-0 align-top">
              <th scope="row" className="text-left px-4 py-3.5 font-medium text-stone-900 dark:text-stone-100">{row.dimension}</th>
              <td className="px-4 py-3.5 text-stone-700 dark:text-stone-300 leading-relaxed">{row.them}</td>
              <td className="px-4 py-3.5 text-stone-700 dark:text-stone-300 leading-relaxed">{row.savvo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface FaqItem {
  q: string
  a: string
}

export function VsFaq({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((faq) => (
        <details key={faq.q} className="group border rounded-xl px-5 py-4 bg-white dark:bg-stone-800 shadow-refined">
          <summary className="cursor-pointer text-sm font-medium flex items-center justify-between gap-4 list-none text-stone-900 dark:text-stone-100">
            {faq.q}
            <svg className="h-4 w-4 shrink-0 text-stone-500 dark:text-stone-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <p className="mt-3 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{faq.a}</p>
        </details>
      ))}
    </div>
  )
}

const COMPARISON_LINKS = [
  { href: "/vs/airtable", label: "Savvo vs Airtable" },
  { href: "/vs/streak", label: "Savvo vs Streak" },
  { href: "/vs/attio", label: "Savvo vs Attio" },
  { href: "/vs/notion", label: "Savvo vs Notion" },
  { href: "/from-spreadsheet", label: "Switching from spreadsheets" },
  { href: "/templates/investor-tracker", label: "Free investor tracker template" },
]

export function MoreComparisons({ current }: { current: string }) {
  return (
    <section className="py-8 border-t">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-700 dark:text-stone-300 text-center mb-5">More comparisons</h2>
      <div className="flex flex-wrap justify-center gap-3">
        {COMPARISON_LINKS.filter((link) => link.href !== current).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center px-4 py-2 rounded-full border text-sm text-stone-700 dark:text-stone-300 hover:border-[var(--copper)]/40 hover:text-[var(--copper)] transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  )
}
