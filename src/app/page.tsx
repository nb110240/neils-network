import { createClient } from "@/lib/supabase/server"
import { getUserPlan } from "@/lib/subscription"
import Link from "next/link"
import type { PlanType } from "@/lib/types"

export default async function Home() {
  // Check for auth cookie before making a network call to Supabase
  // This avoids a ~500ms+ getUser() roundtrip for logged-out visitors
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.includes("auth-token"))

  if (!hasAuthCookie) {
    return <MarketingPage />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <MarketingPage />
  }

  const plan = await getUserPlan(user.id)
  return <FeaturesGuidePage plan={plan} />
}

// ─── Logged-in users: Features Guide ───

function FeatureCard({ title, desc, tier, plan, link }: {
  title: string
  desc: string
  tier: "free" | "pro"
  plan: PlanType
  link: string
}) {
  const hasAccess = tier === "free" || plan === "pro"
  return (
    <Link href={hasAccess ? link : "/pricing"} className="block group">
      <div className={`p-5 rounded-xl border transition-all ${hasAccess ? "hover:border-[var(--copper)]/30 hover:shadow-refined" : "opacity-60 hover:opacity-80"}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold group-hover:text-[var(--copper)] transition-colors">{title}</h3>
          {tier === "pro" && (
            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${plan === "pro" ? "bg-[var(--copper)] text-white" : "bg-muted text-muted-foreground"}`}>
              Pro
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
        {!hasAccess && (
          <p className="text-xs text-[var(--copper)] font-medium mt-2">Upgrade to unlock</p>
        )}
      </div>
    </Link>
  )
}

function FeaturesGuidePage({ plan }: { plan: PlanType }) {
  const features = [
    {
      category: "Add Contacts",
      items: [
        { title: "Natural Language Input", desc: "Type a note about someone you met. Name, company, role, how you met, and next steps are extracted automatically.", tier: "free" as const, link: "/add" },
        { title: "LinkedIn Import", desc: "Paste a LinkedIn profile URL and we'll pull their name, company, role, and bio. One click to add them.", tier: "pro" as const, link: "/add" },
        { title: "CSV Import", desc: "Upload a spreadsheet of contacts. Map columns to fields and import hundreds of contacts at once.", tier: "pro" as const, link: "/import" },
        { title: "Gmail Import", desc: "Connect your Google account and import contacts directly from Google Contacts.", tier: "pro" as const, link: "/import" },
      ],
    },
    {
      category: "Track Relationships",
      items: [
        { title: "Health Scores", desc: "Every contact gets a color-coded score based on recency. Green = active, yellow = cooling, orange = going cold, red = cold. See who needs attention at a glance.", tier: "free" as const, link: "/dashboard" },
        { title: '"Going Cold" Dashboard', desc: "Your dashboard highlights contacts that are going cold. Sorted by urgency so you know exactly who to reach out to first.", tier: "free" as const, link: "/dashboard" },
        { title: "Follow-up Tracking", desc: "Mark contacts as needing follow-up. Set next steps and see all pending follow-ups in one place.", tier: "free" as const, link: "/dashboard" },
      ],
    },
    {
      category: "Find People",
      items: [
        { title: "Keyword Search", desc: "Search by name, company, job title, or any text in your notes. Fast and simple.", tier: "free" as const, link: "/search" },
        { title: "Smart Search", desc: "Ask questions like \"who do I know in healthcare AI?\" or \"people I met at conferences.\" Finds contacts by meaning, not just exact keywords.", tier: "free" as const, link: "/search" },
      ],
    },
    {
      category: "Stay Connected",
      items: [
        { title: "AI Draft Follow-Up (Coming Soon)", desc: "One tap to draft a personalized follow-up message. AI reads your history with the contact — how you met, what you discussed — and writes a natural message you can copy and send.", tier: "pro" as const, link: "/contacts" },
        { title: "AI Schedule Meeting (Coming Soon)", desc: "AI checks your calendar for free slots and drafts a meeting request with 3 time suggestions. Copy, paste, send — meeting booked.", tier: "pro" as const, link: "/contacts" },
        { title: "Daily Digest Email", desc: "Every morning you get an email with 3 relationships that need attention. Each includes context (how you met, last interaction) and a link to log a new interaction.", tier: "pro" as const, link: "/dashboard" },
        { title: "Google Calendar Sync", desc: "Connect your calendar and Savvo automatically creates contacts from your 1:1 meetings. Your network grows while you work.", tier: "pro" as const, link: "/dashboard" },
      ],
    },
    {
      category: "Organize",
      items: [
        { title: "Contact Tags", desc: "Tag contacts by event, industry, relationship type, or anything else. Filter your contacts list by tag to find groups fast.", tier: "free" as const, link: "/contacts" },
        { title: "Event Mode", desc: "Tap 'Start Event' when you arrive at a conference. Every contact you add in the next few hours gets auto-tagged with the event name.", tier: "pro" as const, link: "/dashboard" },
        { title: "Relationship Graph", desc: "Visualize your network as an interactive graph. Nodes colored by health score, connected by shared tags, events, and companies.", tier: "pro" as const, link: "/graph" },
      ],
    },
    {
      category: "Manage Your Account",
      items: [
        { title: "Subscription Management", desc: "Upgrade, downgrade, or cancel your plan anytime. Manage payment methods and view invoices through Stripe.", tier: "free" as const, link: "/pricing" },
        { title: "Install on Phone", desc: "Add Savvo to your home screen on iOS or Android. It works like a native app — full screen, fast, with offline support.", tier: "free" as const, link: "/dashboard" },
        { title: "Offline Mode", desc: "No internet? No problem. Add contacts offline and they sync automatically when you're back online.", tier: "free" as const, link: "/add" },
        { title: "Dark Mode", desc: "Toggle between light and dark themes. Your preference is saved automatically.", tier: "free" as const, link: "/settings" },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <span className="text-xl font-medium tracking-tight text-[var(--copper)]">Savvo</span>
          <div className="flex items-center gap-3">
            {plan === "free" && (
              <Link href="/pricing" className="text-sm font-medium text-[var(--copper)] hover:underline hidden sm:block">
                Upgrade
              </Link>
            )}
            <Link href="/dashboard" className="inline-flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-24 pb-8 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl tracking-tight mb-2">Features Guide</h1>
          <p className="text-lg text-muted-foreground max-w-lg">
            Everything Savvo can do for you.
            {plan === "free" && " Features marked Pro require an upgrade."}
          </p>
        </div>
      </section>

      {features.map((section) => (
        <section key={section.category} className="py-8 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl tracking-tight mb-4 pb-2 border-b">{section.category}</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {section.items.map((f) => (
                <FeatureCard key={f.title} {...f} plan={plan} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between p-6 rounded-2xl border border-[var(--copper)]/20 bg-[var(--copper)]/5">
          <div>
            <h3 className="text-lg font-semibold mb-1">
              {plan === "pro" ? "You're on Pro" : "Get the full experience"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {plan === "pro"
                ? "You have access to every feature. Thank you for your support."
                : "Unlock imports, calendar sync, daily digest, and unlimited search for $8/mo."}
            </p>
          </div>
          {plan === "free" ? (
            <Link href="/pricing" className="shrink-0 inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
              Upgrade to Pro
            </Link>
          ) : (
            <Link href="/dashboard" className="shrink-0 inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold border hover:bg-muted/50 transition-colors">
              Go to Dashboard
            </Link>
          )}
        </div>
      </section>

      <footer className="py-8 px-6 border-t text-center text-sm text-muted-foreground space-y-2">
        <p>&copy; 2026 Savvo. Built for people who care about people.</p>
        <p>
          <Link href="/privacy" className="hover:text-foreground font-medium">Privacy Policy</Link>
          {" "}&middot;{" "}
          <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
        </p>
        <p className="text-xs">Your data is stored securely and never shared with third parties.</p>
      </footer>
    </div>
  )
}

// ─── Logged-out users: Marketing Page ───

function MarketingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <span className="text-xl font-medium tracking-tight text-[var(--copper)]">Savvo</span>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Features</Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Log in</Link>
            <Link href="/login?mode=signup" className="inline-flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-[var(--copper)] mb-4">AI-powered relationship manager</p>
            <h1 className="text-4xl sm:text-5xl leading-[1.08] tracking-tight mb-4">
              Keep every connection <em className="not-italic text-[var(--copper)]">alive</em>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-md">
              Type what you remember about someone. Savvo extracts the details, tracks relationship health, and nudges you before connections go cold.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/login?mode=signup" className="inline-flex items-center px-6 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
                Start free
              </Link>
              <Link href="#how" className="inline-flex items-center px-6 py-3 rounded-xl text-base font-medium border border-border hover:border-[var(--copper)]/30 transition-colors">
                See how it works
              </Link>
            </div>
          </div>
          <div className="relative mt-4 md:mt-0">
            <div className="rounded-2xl border shadow-refined-lg p-6 rotate-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--copper)]/10 flex items-center justify-center text-[var(--copper)] font-semibold text-sm">JD</div>
                <div>
                  <div className="font-semibold">John Doe</div>
                  <div className="text-sm text-muted-foreground">VP of Engineering at Nextera Health</div>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">How we met</span><span>AI Summit 2026</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Health</span><span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500 text-white"><span className="w-1.5 h-1.5 rounded-full bg-white" />Active</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Next step</span><span>Grab coffee next week</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card/50" id="how">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper)] mb-2">How it works</p>
          <h2 className="text-3xl tracking-tight mb-3">Three steps. No forms.</h2>
          <p className="text-muted-foreground mb-10 max-w-lg">Savvo replaces spreadsheets and forgotten business cards. Just talk about the people you meet.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: "01", title: "Write what you remember", desc: "No forms, no fields. Type a quick note like you'd text a friend.", example: '"Met John Doe at AI Summit, he\'s VP of Engineering at Nextera Health, wants to grab coffee next week"' },
              { num: "02", title: "Details are extracted", desc: "Name, company, role, how you met, next steps — all structured automatically." },
              { num: "03", title: "Stay connected effortlessly", desc: "Health scores show which relationships are fading. Daily emails nudge you to reach out." },
            ].map((step) => (
              <div key={step.num}>
                <span className="text-4xl font-normal text-[var(--copper)]/15 block mb-1">{step.num}</span>
                <h3 className="text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                {step.example && (
                  <div className="mt-3 p-3 bg-background rounded-lg text-sm text-muted-foreground italic border-l-3 border-[var(--copper)]">
                    {step.example}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6" id="features">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper)] mb-2">Features</p>
          <h2 className="text-3xl tracking-tight mb-10">Everything your network needs</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: "Natural Language Input", desc: "Just type what you remember. Name, company, context, and next steps are extracted automatically." },
              { title: "Health Scores", desc: "Every contact gets a color-coded score. Green means active. Red means you're about to lose touch." },
              { title: "Smart Search", desc: '"Who do I know in healthcare AI?" Search by meaning, not just keywords.' },
              { title: "AI Follow-Up Drafts", desc: "One tap to draft a personalized follow-up message. AI reads your history and writes something natural." },
              { title: "Daily Digest", desc: "Every morning: 3 relationships that need attention. With context and a one-click link." },
              { title: "CSV & Gmail Import", desc: "Bring your existing network in seconds. Upload a CSV or pull from Google Contacts." },
              { title: "Google Calendar Sync", desc: "Had a 1:1 meeting? Savvo detects it and adds the person automatically." },
              { title: '"Going Cold" Dashboard', desc: "See every fading relationship at a glance. Sorted by urgency." },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-xl border hover:border-[var(--copper)]/30 hover:shadow-refined transition-all">
                <h3 className="text-base font-medium mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Trust */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper)] mb-2">Your data, your control</p>
          <h2 className="text-3xl tracking-tight mb-10">Built for trust</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-lg">&#128274;</div>
              <div>
                <h3 className="font-medium mb-1">We never sell your data</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Your contacts are yours. We don&apos;t share, sell, or train AI models on your network data. Ever.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-lg">&#9889;</div>
              <div>
                <h3 className="font-medium mb-1">Everything is optional</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Google sync, imports, and calendar are all opt-in. Use Savvo with just manual notes if you prefer — no account linking required.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-lg">&#128220;</div>
              <div>
                <h3 className="font-medium mb-1">Export anytime</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Download all your contacts as a CSV whenever you want. Delete your account and all data is permanently removed within 30 days.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* See it in action */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper)] mb-2">See it in action</p>
          <h2 className="text-3xl tracking-tight mb-3">What the app actually looks like</h2>
          <p className="text-muted-foreground mb-10 max-w-lg">No guessing. Here&apos;s what you&apos;ll use every day.</p>

          {/* Row 1: Dashboard + Add Contact */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Dashboard mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dashboard</h3>
                <span className="text-xs text-muted-foreground">Your daily view</span>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Contacts</p><p className="text-xl font-normal">47</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Reach Out</p><p className="text-xl font-normal text-[var(--copper)]">5</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Going Cold</p><p className="text-xl font-normal text-red-500">3</p></div>
                </div>
                <div className="rounded-lg border-l-2 border-l-[var(--copper)] p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">REACH OUT TODAY</p>
                  {[
                    { name: "Sarah Chen", info: "Sequoia · 2 months ago", color: "bg-orange-500" },
                    { name: "Marcus Webb", info: "Follow-up needed", color: "bg-amber-400" },
                    { name: "Priya Patel", info: "Founder, Lumina · 3 months ago", color: "bg-red-500" },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${c.color}`} />
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{c.info}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-1">Every morning, Savvo tells you exactly who needs attention — prioritized by urgency so you always know where to start.</p>
              </div>
            </div>

            {/* Add contact mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Add Contact</h3>
                <span className="text-xs text-muted-foreground">Just type what you remember</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border p-3 text-sm text-muted-foreground italic leading-relaxed">
                  &ldquo;Met Sarah Chen at the Founders Dinner last night. She&apos;s a partner at Sequoia focused on B2B SaaS. We talked about the CRM space and she mentioned they&apos;re looking at AI-native tools. Should send her our deck next week.&rdquo;
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">&#8595; AI extracts automatically</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">Sarah Chen</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span>Sequoia</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span>Partner, B2B SaaS</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">How we met</span><span>Founders Dinner</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Next step</span><span>Send deck next week</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Follow-up</span><span className="text-amber-600 font-medium">Yes</span></div>
                </div>
                <p className="text-xs text-muted-foreground pt-1">No forms. No fields. Just write what you&apos;d text a friend — AI handles the rest in seconds.</p>
              </div>
            </div>
          </div>

          {/* Row 2: Contact Detail + Search */}
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            {/* Contact detail mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact Detail</h3>
                <span className="text-xs text-muted-foreground">Everything about a person in one place</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--copper)]/10 flex items-center justify-center text-[var(--copper)] font-semibold text-sm">SC</div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">Sarah Chen <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500 text-white"><span className="w-1 h-1 rounded-full bg-white" />Going cold</span></div>
                    <div className="text-xs text-muted-foreground">Partner at Sequoia</div>
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">ACTIVITY TIMELINE</p>
                  <div className="flex gap-2 items-start">
                    <span className="w-2 h-2 rounded-full bg-[var(--copper)] mt-1.5 shrink-0" />
                    <div><span className="text-xs text-muted-foreground">Jan 15 · Meeting</span><p className="text-sm">Grabbed coffee, discussed AI CRM landscape. She&apos;s interested in early-stage tools.</p></div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div><span className="text-xs text-muted-foreground">Jan 10 · Email</span><p className="text-sm">Sent intro email after Founders Dinner.</p></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs px-2 py-1 rounded-md border bg-muted/50">&#x1f4ac; Draft Follow-Up</span>
                  <span className="text-xs px-2 py-1 rounded-md border bg-muted/50">&#x1f4c5; Meeting Prep</span>
                  <span className="text-xs px-2 py-1 rounded-md border bg-muted/50">&#x270f;&#xfe0f; Edit</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">See the full history, log interactions, and draft AI-powered follow-ups — all from one screen.</p>
              </div>
            </div>

            {/* Smart search mock */}
            <div className="rounded-2xl border shadow-refined p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Smart Search</h3>
                <span className="text-xs text-muted-foreground">Find people by meaning, not keywords</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border p-3 text-sm flex items-center gap-2">
                  <span className="text-muted-foreground">&#128269;</span>
                  <span className="italic text-muted-foreground">&ldquo;who do I know in healthcare AI?&rdquo;</span>
                </div>
                <p className="text-xs text-muted-foreground">3 results</p>
                {[
                  { name: "Dr. Amy Liu", role: "Chief Medical Officer, HealthBridge AI", match: "92%" },
                  { name: "James Torres", role: "ML Engineer, Tempus", match: "87%" },
                  { name: "Nina Shah", role: "Founder, MedFlow", match: "81%" },
                ].map((r) => (
                  <div key={r.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-sm">
                    <div>
                      <span className="font-medium">{r.name}</span>
                      <p className="text-xs text-muted-foreground">{r.role}</p>
                    </div>
                    <span className="text-xs text-[var(--copper)] font-medium">{r.match} match</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">Ask natural questions about your network. Savvo searches by meaning — not just names and keywords.</p>
              </div>
            </div>
          </div>

          {/* Row 3: Daily Digest Email mock */}
          <div className="mt-6">
            <div className="rounded-2xl border shadow-refined p-5 max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Daily Digest Email</h3>
                <span className="text-xs text-muted-foreground">Lands in your inbox every morning</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="font-medium mb-2">Hey Neil, 3 relationships need your attention:</p>
                  {[
                    { name: "Sarah Chen", context: "You met at Founders Dinner · Last contact: 2 months ago", color: "bg-orange-500" },
                    { name: "Marcus Webb", context: "Has a follow-up pending · Next step: Review proposal", color: "bg-amber-400" },
                    { name: "Priya Patel", context: "Founder at Lumina · Last contact: 3 months ago", color: "bg-red-500" },
                  ].map((c) => (
                    <div key={c.name} className="flex items-start gap-2 py-2 border-t first:border-t-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.color} mt-1.5 shrink-0`} />
                      <div>
                        <span className="font-medium text-sm">{c.name}</span>
                        <p className="text-xs text-muted-foreground">{c.context}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">No app to open. No tasks to check. Just read your email, tap a name, and reconnect. Pro users get this every morning.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/login?mode=signup" className="inline-flex items-center px-6 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
              Try it yourself — free
            </Link>
            <p className="text-sm text-muted-foreground mt-3">No credit card required. Set up in 30 seconds.</p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card/50" id="pricing">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--copper)] mb-2">Pricing</p>
          <h2 className="text-3xl tracking-tight mb-2">Start free. Upgrade when you need more.</h2>
          <p className="text-muted-foreground mb-10">No credit card required.</p>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="p-6 rounded-2xl border">
              <div className="font-semibold mb-1">Free</div>
              <div className="text-3xl font-normal mb-1">$0 <span className="text-base text-muted-foreground font-normal">/month</span></div>
              <p className="text-sm text-muted-foreground mb-4">For getting started</p>
              <ul className="space-y-2 text-sm mb-6">
                {["50 contacts", "Health scores", "Natural language input", "5 smart searches / month"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-emerald-500 font-bold">&#10003;</span> {f}</li>
                ))}
                {["Import (CSV & Gmail)", "Google Calendar sync", "Daily digest emails"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-muted-foreground/50"><span className="font-bold">&#10007;</span> {f}</li>
                ))}
              </ul>
              <Link href="/login?mode=signup" className="block text-center py-2.5 rounded-lg border font-medium text-sm hover:bg-muted/50 transition-colors">Get started</Link>
            </div>
            <div className="p-6 rounded-2xl border border-[var(--copper)]/30 relative">
              <div className="absolute -top-3 right-4 bg-[var(--copper)] text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full">Most popular</div>
              <div className="font-semibold mb-1">Pro</div>
              <div className="text-3xl font-normal mb-1"><span className="text-lg text-muted-foreground line-through mr-1">$8</span>$5 <span className="text-base text-muted-foreground font-normal">/month</span></div>
              <p className="text-sm text-emerald-600 font-medium mb-4">Launch price until June 1 &middot; or <span className="line-through text-muted-foreground">$75</span> $50/year</p>
              <ul className="space-y-2 text-sm mb-6">
                {["Unlimited contacts", "Health scores", "Natural language input", "Unlimited smart search", "AI follow-up drafts (coming soon)", "CSV & Gmail import", "Google Calendar sync", "Daily digest emails", "Event mode", "LinkedIn import"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-emerald-500 font-bold">&#10003;</span> {f}</li>
                ))}
              </ul>
              <Link href="/login?mode=signup" className="block text-center py-2.5 rounded-lg bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white font-medium text-sm hover:opacity-90 transition-opacity">Start free, upgrade anytime</Link>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Team plan coming soon — $12/user/mo. Shared graphs, intro requests, and admin tools.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6 text-center">
        <h2 className="text-3xl tracking-tight mb-3">Your network is your net worth.<br />Stop letting it decay.</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">Join founders, VCs, and connectors who use Savvo to keep every connection alive.</p>
        <Link href="/login?mode=signup" className="inline-flex items-center px-6 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-opacity">
          Get Started Free
        </Link>
      </section>

      <footer className="py-8 px-6 border-t text-center text-sm text-muted-foreground space-y-2">
        <p>&copy; 2026 Savvo. Built for people who care about people.</p>
        <p>
          <Link href="/privacy" className="hover:text-foreground font-medium">Privacy Policy</Link>
          {" "}&middot;{" "}
          <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
        </p>
        <p className="text-xs">Your data is stored securely and never shared with third parties.</p>
      </footer>
    </div>
  )
}
