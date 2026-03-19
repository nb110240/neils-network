import Link from "next/link"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/" className="text-xl font-medium tracking-tight text-[var(--copper)]">Savvo</Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign In</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-normal tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 18, 2026</p>

        <div className="prose prose-stone max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Agreement</h2>
            <p>By using Savvo (&quot;the Service&quot;), you agree to these terms. If you don&apos;t agree, don&apos;t use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">What Savvo Does</h2>
            <p>Savvo is a relationship management tool that helps you track professional contacts. You input information about people you meet, and we help you stay connected through health scores, search, and email reminders.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Your Account</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You&apos;re responsible for keeping your password secure.</li>
              <li>You must provide accurate information when signing up.</li>
              <li>You can delete your account at any time from Settings.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You own your data. We don&apos;t claim ownership of any contacts or notes you create.</li>
              <li>You can export your data as CSV at any time.</li>
              <li>You can delete all your data at any time.</li>
              <li>See our <Link href="/privacy" className="text-[var(--copper)] hover:underline">Privacy Policy</Link> for how we handle your data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Payments</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Free tier: 50 contacts, basic features, no payment required.</li>
              <li>Pro tier: paid monthly or yearly via Stripe.</li>
              <li>You can cancel anytime. Access continues until the end of your billing period.</li>
              <li>No refunds for partial billing periods.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Acceptable Use</h2>
            <p>Don&apos;t use Savvo to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Store data you don&apos;t have the right to store.</li>
              <li>Spam or harass people.</li>
              <li>Attempt to access other users&apos; data.</li>
              <li>Reverse engineer or scrape the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Limitation of Liability</h2>
            <p>Savvo is provided &quot;as is&quot; without warranties. We&apos;re not liable for any damages arising from your use of the Service. Our total liability is limited to the amount you&apos;ve paid us in the last 12 months.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Changes</h2>
            <p>We may update these terms. If we make significant changes, we&apos;ll notify you via email. Continued use after changes means you accept the new terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Contact</h2>
            <p>Questions? Email <a href="mailto:neil@savvo.app" className="text-[var(--copper)] hover:underline">neil@savvo.app</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
