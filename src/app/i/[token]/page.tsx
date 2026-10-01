import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createServiceClient } from "@/lib/supabase/server"
import { isValidShareToken } from "@/lib/share-token"
import { IntroResponseForm } from "./intro-response-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Introduction request",
  robots: { index: false, follow: false },
}

interface IntroSummary {
  requester_name: string | null
  connector_name: string | null
  target_name: string | null
  target_company: string | null
  target_job_title: string | null
  reason: string
  draft_message: string
  status: string
  responded_at: string | null
}

async function loadIntro(token: string): Promise<IntroSummary | null> {
  if (!isValidShareToken(token)) return null
  const service = await createServiceClient()
  const { data, error } = await service.rpc("intro_request_for_token", { p_token: token })
  if (error || !data) return null
  return data as IntroSummary
}

export default async function IntroRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const intro = await loadIntro(token)
  if (!intro) notFound()

  const requester = intro.requester_name || "A founder you know"
  const requesterFirstName = intro.requester_name?.split(" ")[0] || "them"
  const target = intro.target_name || "someone in your network"
  const targetRole = [intro.target_job_title, intro.target_company].filter(Boolean).join(" at ")
  const answered = intro.responded_at !== null || !["draft", "requested"].includes(intro.status)

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-xl px-4 py-12 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--copper-text)]">Introduction request</p>
        <h1 className="mt-2 text-3xl font-normal tracking-tight text-stone-900 dark:text-stone-100">
          {intro.connector_name ? `${intro.connector_name.split(" ")[0]}, ` : ""}
          {requester} would like an intro to {target}
        </h1>
        {targetRole && <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">{target} · {targetRole}</p>}

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-refined dark:border-stone-700 dark:bg-stone-900">
          <h2 className="text-sm font-medium text-stone-900 dark:text-stone-100">Why</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700 dark:text-stone-300">{intro.reason}</p>
          <h2 className="mt-5 text-sm font-medium text-stone-900 dark:text-stone-100">Their note to you</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700 dark:text-stone-300">{intro.draft_message}</p>
        </section>

        <div className="mt-6">
          {answered ? (
            <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-center text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300" role="status">
              This request already has an answer. Thanks for helping.
            </p>
          ) : (
            <IntroResponseForm token={token} requesterFirstName={requesterFirstName} />
          )}
        </div>

        <footer className="mt-12 text-center">
          <Link href="/?utm_source=intro_request&utm_medium=share" className="text-xs text-stone-700 underline-offset-2 hover:underline dark:text-stone-300">
            Sent with Savvo, the relationship manager for founders
          </Link>
        </footer>
      </main>
    </div>
  )
}
