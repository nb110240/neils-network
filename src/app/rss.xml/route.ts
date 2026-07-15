import { BLOG_POSTS, SITE_URL } from "@/lib/blog-posts"

export const dynamic = "force-static"

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function GET(): Response {
  const sorted = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime()
  )

  const lastBuildDate = sorted.length
    ? new Date(`${sorted[0].datePublished}T00:00:00Z`).toUTCString()
    : new Date(0).toUTCString()

  const items = sorted
    .map((post) => {
      const url = `${SITE_URL}/blog/${post.slug}`
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(`${post.datePublished}T00:00:00Z`).toUTCString()}</pubDate>
      <author>neil@savvo.app (${escapeXml(post.author)})</author>
    </item>`
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Savvo Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Practical guides on fundraising and investor relationships, from the team behind Savvo, the investor CRM for founders raising a round.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  })
}
