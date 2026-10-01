import { summarizeStages } from "@/lib/investor-stage"

// Stage-by-stage counts for a raise. Server-safe: used by the public
// snapshot page and the owner's preview in Settings.
export function RaiseFunnel({ stages }: { stages: Record<string, number> | null | undefined }) {
  const summary = summarizeStages(stages)
  const max = Math.max(1, ...summary.rows.map((r) => r.count))

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "In play", value: summary.active },
          { label: "Committed", value: summary.committed },
          { label: "Passed", value: summary.passed },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-900">
            <dt className="text-xs text-stone-700 dark:text-stone-300">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-normal text-stone-900 dark:text-stone-100">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <ol className="space-y-2" aria-label="Investors by stage">
        {summary.rows.map((row) => (
          <li key={row.value} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span className="text-stone-700 dark:text-stone-300">{row.label}</span>
            <span className="h-2.5 rounded-full bg-stone-100 dark:bg-stone-800" aria-hidden="true">
              <span
                className={`block h-full rounded-full ${row.value === "passed" ? "bg-stone-400 dark:bg-stone-500" : "bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)]"}`}
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-stone-900 dark:text-stone-100">{row.count}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
