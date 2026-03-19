import Link from "next/link"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/" className="text-xl font-medium tracking-tight text-[var(--copper)]">Savvo</Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign In</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-normal tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 18, 2026</p>

        <div className="prose prose-stone max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">What We Collect</h2>
            <p>When you use Savvo, we collect:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Account info:</strong> Your email address and name when you sign up.</li>
              <li><strong>Contacts you add:</strong> Names, companies, notes, and any details you enter about people in your network.</li>
              <li><strong>Google data (if connected):</strong> Calendar events (read-only) and Google Contacts (read-only), only when you explicitly connect these services.</li>
              <li><strong>Usage data:</strong> Basic analytics like which features you use to improve the product.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and improve Savvo&apos;s features (contact management, health scores, search, digest emails).</li>
              <li>To send you daily digest emails (Pro users only, configurable in settings).</li>
              <li>To process your contacts through AI for data extraction (OpenAI/Google AI). Your data is not used to train AI models.</li>
              <li>To process payments through Stripe.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">What We Don&apos;t Do</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We never sell your data to third parties.</li>
              <li>We never share your contacts with other users.</li>
              <li>We never use your data for advertising.</li>
              <li>We never access your Google data without your explicit permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Data Storage & Security</h2>
            <p>Your data is stored securely on Supabase (PostgreSQL) with row-level security. All connections use HTTPS. Sensitive data like API keys are stored as environment variables, never in source code.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Google API Disclosure</h2>
            <p>Savvo&apos;s use of Google APIs (Calendar, Contacts) adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-[var(--copper)] hover:underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. We only access the data you authorize and use it solely to provide Savvo&apos;s features.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Delete Your Data</h2>
            <p>You can delete your entire account and all associated data at any time from Settings &rarr; Danger Zone &rarr; Delete Account. This permanently removes all your contacts, preferences, and account information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">Contact</h2>
            <p>Questions about privacy? Email <a href="mailto:neil@savvo.app" className="text-[var(--copper)] hover:underline">neil@savvo.app</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
