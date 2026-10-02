import type { Metadata } from "next"
import Link from "next/link"

// Public on purpose: the App Store and Google Play require a support URL
// that works for a logged-out reviewer. /support (the in-app form) needs an
// account, so logged-out visits there are sent here by src/proxy.ts.
const SUPPORT_EMAIL = "neil@savvo.app"

export const metadata: Metadata = {
  title: "Help & Support",
  description:
    "Get help with Savvo: signing in, subscriptions on the web, App Store and Google Play, exporting your data, and deleting your account.",
  alternates: { canonical: "/help" },
  openGraph: {
    title: "Help & Support | Savvo",
    description: "Answers to common questions and how to reach the Savvo team.",
    url: "/help",
  },
}

const linkClass = "text-[var(--copper-text)] underline underline-offset-2"

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "sign-in",
    title: "Signing in",
    body: (
      <>
        <p>
          Sign in with email and password, Google, or Apple, using the same method you signed up with.
        </p>
        <p>
          Forgot your password? Choose <strong>Forgot password?</strong> on the{" "}
          <Link href="/login" className={linkClass}>sign-in page</Link> and we’ll email you a reset link.
        </p>
      </>
    ),
  },
  {
    id: "subscriptions",
    title: "Subscriptions and billing",
    body: (
      <>
        <p>Your plan is managed wherever you bought it:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>On the web:</strong> Settings &rarr; Subscription &rarr; <strong>Manage Plan</strong> opens the billing
            portal, where you can change or cancel.
          </li>
          <li>
            <strong>iPhone and iPad:</strong> open the Settings app, tap your name, then <strong>Subscriptions</strong>.
          </li>
          <li>
            <strong>Android:</strong> open Google Play, tap your profile, then{" "}
            <strong>Payments &amp; subscriptions &rarr; Subscriptions</strong>.
          </li>
        </ul>
        <p>
          New phone or reinstalled the app? Tap <strong>Restore purchases</strong> on the pricing screen to bring
          your subscription back. Cancelling keeps Pro until the end of the period you’ve paid for.
        </p>
      </>
    ),
  },
  {
    id: "export",
    title: "Exporting your data",
    body: (
      <p>
        Settings &rarr; <strong>Export all data</strong> downloads everything you’ve stored as JSON. To export
        just your contacts as a spreadsheet, use <strong>Export CSV</strong> on the Contacts page.
      </p>
    ),
  },
  {
    id: "delete-account",
    title: "Deleting your account",
    body: (
      <>
        <p>
          In the app or on the web, go to Settings &rarr; Danger Zone &rarr; <strong>Delete Account</strong>. This
          permanently removes your contacts, meeting notes, commitments, and account. It can’t be undone, so
          export first if you want a copy.
        </p>
        <p>
          Can’t sign in? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20Savvo%20account`} className={linkClass}>
            {SUPPORT_EMAIL}
          </a>{" "}
          from the address on your account and we’ll delete it for you.
        </p>
        <p>
          Deleting your account doesn’t cancel an App Store or Google Play subscription. Cancel it in the store
          as described above.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy",
    body: (
      <p>
        We never sell your data or use it for advertising. Read the full{" "}
        <Link href="/privacy" className={linkClass}>privacy policy</Link> and{" "}
        <Link href="/terms" className={linkClass}>terms of service</Link>.
      </p>
    ),
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/" className="text-xl font-medium tracking-tight text-[var(--copper-text)]">Savvo</Link>
          <Link href="/login" className="inline-flex py-2 text-sm text-muted-foreground hover:text-foreground">Sign In</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-normal tracking-tight text-stone-900 dark:text-stone-100 mb-2">Help &amp; Support</h1>
        <p className="text-base text-stone-700 dark:text-stone-300 mb-8">
          Answers to common questions. Still stuck? We typically respond within 24 hours.
        </p>

        <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-700 dark:bg-stone-900">
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Contact us</p>
          <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">
            Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>{SUPPORT_EMAIL}</a>
            . Signed in? You can also{" "}
            <Link href="/support" className={linkClass}>send a message from the app</Link>.
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20 space-y-2">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mt-8 mb-3">{section.title}</h2>
              {section.body}
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
