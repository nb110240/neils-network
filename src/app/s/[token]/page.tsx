import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createServiceClient } from "@/lib/supabase/server"
import { isValidShareToken } from "@/lib/share-token"
import { RaiseFunnel } from "@/components/raise-funnel"

export const dynamic = "force-dynamic"

// Share links are private by obscurity: keep them out of search results.
export const metadata: Metadata = {
  title: "Raise snapshot",
  robots: { index: false, follow: false },
}

interface SnapshotSummary {
  title: string | null
  stages: Record<string, number>
  updated_at: string
}

async function loadSnapshot(token: string): Promise<SnapshotSummary | null> {
  if (!isValidShareToken(token)) return null
  const service = await createServiceClient()
  const { data, error } = await service.rpc("raise_snapshot_summary", { p_token: token })
  if (error || !data) return null
  return data as SnapshotSummary
}

export default async function RaiseSnapshotPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const snapshot = await loadSnapshot(token)
  if (!snapshot) notFound()

  const updated = new Date(snapshot.updated_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-xl px-4 py-12 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--copper-text)]">Raise snapshot</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-normal tracking-tight text-stone-900 dark:text-stone-100">
          {snapshot.title || "Fundraise progress"}
        </h1>
        <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
          Updated {updated}. Counts only; investor names stay private.
        </p>

        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-refined dark:border-stone-700 dark:bg-stone-900">
          <RaiseFunnel stages={snapshot.stages} />
        </div>

        <footer className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-stone-700 dark:text-stone-300">Tracking a raise of your own?</p>
          <Link
            href="/templates/investor-tracker?utm_source=raise_snapshot&utm_medium=share"
            className="inline-flex min-h-11 items-center rounded-lg bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] px-5 text-sm font-medium text-white hover:opacity-90"
          >
            Get the free investor tracker
          </Link>
          <Link href="/?utm_source=raise_snapshot&utm_medium=share" className="text-xs text-stone-700 underline-offset-2 hover:underline dark:text-stone-300">
            Made with Savvo
          </Link>
        </footer>
      </main>
    </div>
  )
}
