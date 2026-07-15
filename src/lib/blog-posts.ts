export interface BlogPost {
  slug: string
  title: string
  description: string
  /** ISO date, e.g. "2026-07-14" */
  datePublished: string
  author: string
  readingMinutes: number
}

export const SITE_URL = "https://savvo.app"

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-track-investor-outreach-seed-round",
    title: "How to Track Investor Outreach During a Seed Round",
    description:
      "A practical system for tracking investor outreach at seed: build your list in waves, use statuses that mean something, follow up within 48 hours, and run a weekly pipeline review solo.",
    datePublished: "2026-07-14",
    author: "Neil Bajaj",
    readingMinutes: 7,
  },
  {
    slug: "how-many-investors-to-pitch-seed-round",
    title: "How Many Investors Do You Need to Pitch to Close a Seed Round?",
    description:
      "The honest answer, with data: DocSend's 2023 research shows founders contacted 66 investors on average at seed. Here is the funnel math from target list to meetings to term sheets, and what changes the ratio.",
    datePublished: "2026-07-14",
    author: "Neil Bajaj",
    readingMinutes: 7,
  },
  {
    slug: "fundraising-crm-comparison",
    title:
      "Fundraising CRM Comparison: Savvo vs Airtable vs Streak vs Attio vs Notion (2026)",
    description:
      "An honest comparison of five tools founders use to track a raise: Airtable, Streak, Attio, Notion, and Savvo. What each is best for, where each breaks, and a summary table.",
    datePublished: "2026-07-14",
    author: "Neil Bajaj",
    readingMinutes: 8,
  },
]

export function getPost(slug: string): BlogPost {
  const post = BLOG_POSTS.find((p) => p.slug === slug)
  if (!post) throw new Error(`Unknown blog post slug: ${slug}`)
  return post
}
