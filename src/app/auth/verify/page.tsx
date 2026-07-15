import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Email Verified | Savvo",
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <img src="/logo.svg" alt="Savvo" className="h-8 w-8" />
          <span className="text-2xl font-medium tracking-tight text-[var(--copper)]">Savvo</span>
        </Link>

        <div className="rounded-2xl border bg-white dark:bg-stone-900 shadow-refined-lg p-8">
          <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-5">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-normal tracking-tight mb-2">You&apos;re verified!</h1>
          <p className="text-muted-foreground mb-6">
            Your email has been confirmed. You&apos;re ready to start building your network.
          </p>

          <Link
            href="/add"
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity"
          >
            Add your first contact
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Having trouble? Contact <a href="mailto:neil@savvo.app" className="text-[var(--copper)] hover:underline">neil@savvo.app</a>
        </p>
      </div>
    </div>
  )
}
