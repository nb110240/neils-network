import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { isValidShareToken } from "@/lib/share-token"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pipeline email",
  robots: { index: false, follow: false },
}

// Public: the person who gets a founder's weekly pipeline email isn't a
// Savvo user. Unsubscribing takes a button press (a POST), never a page
// load, so email link scanners can't unsubscribe anyone by prefetching.
export default async function PipelineUnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ done?: string }>
}) {
  const { token } = await params
  const { done } = await searchParams
  if (!isValidShareToken(token)) notFound()

  const service = await createServiceClient()
  const { data: recipient } = await service
    .from("pipeline_digest_recipients")
    .select("user_id, email, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle()
  if (!recipient) notFound()

  const { data: { user: founder } } = await service.auth.admin.getUserById(recipient.user_id)
  const founderName =
    (founder?.user_metadata?.full_name as string | undefined)?.trim() || founder?.email?.split("@")[0] || "This founder"
  const stopped = Boolean(recipient.unsubscribed_at) || done === "1"

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/85 backdrop-blur-md">
        <div className="max-w-xl mx-auto flex items-center px-4 sm:px-6 h-14">
          <Link href="/" className="text-xl font-medium tracking-tight text-[var(--copper-text)]">Savvo</Link>
        </div>
      </nav>
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-16">
        <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900">
          {stopped ? (
            <>
              <h1 className="text-2xl font-normal tracking-tight text-stone-900 dark:text-stone-100">You’re unsubscribed</h1>
              <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
                {recipient.email} won’t get {founderName}’s weekly pipeline email anymore.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-normal tracking-tight text-stone-900 dark:text-stone-100">Stop the weekly pipeline email?</h1>
              <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
                {founderName} shares their fundraising pipeline with {recipient.email} every Monday.
              </p>
              <form method="post" action="/api/pipeline-digest/unsubscribe" className="mt-6">
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-lg bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] px-5 text-sm font-medium text-white hover:opacity-90"
                >
                  Stop these emails
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
