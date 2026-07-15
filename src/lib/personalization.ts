// Networking goal-based personalization
// Stored in Supabase user_metadata.networking_goal

export type NetworkingGoal =
  | "fundraising"
  | "hiring"
  | "partnerships"
  | "sales"
  | "community"
  | "general"

export interface GoalConfig {
  label: string
  emoji: string
  tagline: string
  /** Subtitle shown on the welcome screen after goal is picked */
  welcomeSubtitle: string
  /** Placeholder example for the add contact textarea */
  addContactPlaceholder: string
  /** Which features to emphasize (top 2) */
  featureHighlights: [string, string]
  /** Dashboard greeting suffix */
  dashboardContext: string
  /** Walkthrough: what "Reach Out" means for them */
  reachOutExplanation: string
}

export const GOAL_OPTIONS: { value: NetworkingGoal; label: string; emoji: string; description: string }[] = [
  { value: "fundraising", label: "Fundraising", emoji: "💰", description: "Meeting investors and managing dealflow" },
  { value: "hiring", label: "Hiring", emoji: "🧑‍💻", description: "Finding and nurturing talent" },
  { value: "partnerships", label: "Partnerships", emoji: "🤝", description: "Building strategic relationships" },
  { value: "sales", label: "Sales", emoji: "📈", description: "Growing pipeline and closing deals" },
  { value: "community", label: "Community", emoji: "🌐", description: "Growing and connecting a community" },
  { value: "general", label: "General networking", emoji: "👋", description: "Staying on top of all my relationships" },
]

export const GOAL_CONFIGS: Record<NetworkingGoal, GoalConfig> = {
  fundraising: {
    label: "Fundraising",
    emoji: "💰",
    tagline: "Never lose track of an investor relationship",
    welcomeSubtitle: "Savvo helps you manage investor relationships, track warm intros, and stay top-of-mind with the VCs who matter.",
    addContactPlaceholder: "Example: Met Sarah Chen at Demo Day. She's a partner at Sequoia, focused on B2B SaaS. Interested in our Series A and wants to see Q2 metrics. Intro'd by Mike at YC. Follow up next week with deck.",
    featureHighlights: ["Track investor touchpoints", "Never let a warm intro go cold"],
    dashboardContext: "Your investor pipeline",
    reachOutExplanation: "These investors and contacts haven't heard from you recently. In fundraising, staying warm between rounds is what gets you the next meeting.",
  },
  hiring: {
    label: "Hiring",
    emoji: "🧑‍💻",
    tagline: "Build a talent pipeline, not just a job board",
    welcomeSubtitle: "Savvo helps you nurture candidates over time, track referrals, and re-engage great people when the right role opens.",
    addContactPlaceholder: "Example: Met Alex Rivera at React Conf. Senior engineer at Stripe, 6 years experience. Really sharp on infra. Not looking right now but open to future conversations. Should ping again in Q3.",
    featureHighlights: ["Nurture candidates over time", "Track referrals and warm connections"],
    dashboardContext: "Your talent pipeline",
    reachOutExplanation: "These candidates and referral sources are going cold. The best hires come from relationships you maintain before you need them.",
  },
  partnerships: {
    label: "Partnerships",
    emoji: "🤝",
    tagline: "Turn conversations into collaborations",
    welcomeSubtitle: "Savvo helps you track partner conversations, remember commitments, and follow through on every collaboration opportunity.",
    addContactPlaceholder: "Example: Met Jordan Lee at SaaStr. Head of BD at Notion. They're looking for integration partners in the CRM space. Wants to do a co-marketing webinar. Follow up with proposal by Friday.",
    featureHighlights: ["Track partnership conversations", "Never miss a follow-through"],
    dashboardContext: "Your partnership pipeline",
    reachOutExplanation: "These partners and potential collaborators need attention. Partnerships die from neglect, so a quick check-in keeps momentum alive.",
  },
  sales: {
    label: "Sales",
    emoji: "📈",
    tagline: "Relationships close deals, not cold emails",
    welcomeSubtitle: "Savvo helps you track prospects from first meeting to closed deal, with AI-powered follow-up reminders and relationship health tracking.",
    addContactPlaceholder: "Example: Met Dana Park at the Fintech Summit. VP of Ops at Plaid, managing a team of 40. Pain point: their current CRM doesn't track relationship context. Budget decision in Q2. Need to send case study.",
    featureHighlights: ["Track prospect conversations", "AI-powered follow-up reminders"],
    dashboardContext: "Your relationship pipeline",
    reachOutExplanation: "These prospects and champions are going cold. Deals are won in the follow-up, and staying top-of-mind is everything.",
  },
  community: {
    label: "Community",
    emoji: "🌐",
    tagline: "Know your community, connect your people",
    welcomeSubtitle: "Savvo helps you remember every community member, spot intro opportunities, and keep your most valuable relationships warm.",
    addContactPlaceholder: "Example: Met Priya Shah at the SF Founders Dinner. She's building an edtech startup, pre-seed. Super passionate about accessibility. Knows the team at Replit. Should connect her with James who's hiring for similar roles.",
    featureHighlights: ["Spot introduction opportunities", "Track who knows who"],
    dashboardContext: "Your community",
    reachOutExplanation: "These community members haven't heard from you recently. Great community builders are proactive connectors, so check in and see how they're doing.",
  },
  general: {
    label: "General networking",
    emoji: "👋",
    tagline: "Keep every connection alive",
    welcomeSubtitle: "Savvo tracks your relationships and tells you when they need attention. No more forgotten follow-ups or cold connections.",
    addContactPlaceholder: "Example: Met John Doe at the AI Summit. He's VP of Engineering at Acme Corp. We talked about their platform and he mentioned they're hiring. Should follow up next week.",
    featureHighlights: ["Health scores track every relationship", "Never forget a follow-up"],
    dashboardContext: "Your network overview",
    reachOutExplanation: "These contacts need attention because they have pending follow-ups or your relationship is going cold. A quick message keeps things warm.",
  },
}

/** Get time-of-day greeting */
export function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

/** Infer company from email domain */
export function inferCompanyFromEmail(email: string | undefined): string | null {
  if (!email) return null
  const domain = email.split("@")[1]
  if (!domain) return null
  // Skip common personal email providers
  const personal = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "protonmail.com", "hey.com", "me.com", "live.com", "aol.com"]
  if (personal.includes(domain)) return null
  // Return the domain name capitalized (e.g., "stripe.com" → "Stripe")
  const name = domain.split(".")[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}
