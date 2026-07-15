import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BLOG_POSTS } from "@/lib/blog-posts"
import { formatPostDate } from "./post-shell"

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Practical guides on fundraising and investor relationships: how to track outreach, how many investors to pitch, and which tools to run your raise on.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | Savvo",
    description:
      "Practical guides on fundraising and investor relationships, written by a founder for founders.",
    url: "/blog",
  },
}

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-stone-700 dark:text-stone-300 hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Savvo
        </Link>

        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-normal font-[family-name:var(--font-dm-serif)] text-stone-900 dark:text-stone-100">
            Blog
          </h1>
          <p className="text-base text-stone-700 dark:text-stone-300 mt-3 max-w-xl">
            Practical guides on fundraising and investor relationships, written by{" "}
            <Link href="https://x.com/neilbajaj" className="text-[var(--copper)] hover:underline">
              @neilbajaj
            </Link>
            . No fluff, just what works.
          </p>
        </header>

        <div className="space-y-10">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.slug}
              className="pl-6 border-l-2 border-[var(--copper)]/20 hover:border-[var(--copper)]/40 transition-colors"
            >
              <p className="text-sm text-stone-700 dark:text-stone-300 font-mono mb-1.5">
                {formatPostDate(post.datePublished)}
                <span aria-hidden="true"> &middot; </span>
                {post.readingMinutes} min read
              </p>
              <h2 className="text-xl font-semibold leading-snug text-stone-900 dark:text-stone-100">
                <Link href={`/blog/${post.slug}`} className="hover:text-[var(--copper)] transition-colors">
                  {post.title}
                </Link>
              </h2>
              <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed mt-2">
                {post.description}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="inline-block text-sm font-medium text-[var(--copper)] hover:underline mt-3"
              >
                Read the guide →
              </Link>
            </article>
          ))}
        </div>

        <footer className="mt-16 pt-8 border-t border-stone-200 dark:border-stone-800 text-sm text-stone-700 dark:text-stone-300">
          <p>
            Subscribe via{" "}
            <Link href="/rss.xml" className="text-[var(--copper)] hover:underline">
              RSS
            </Link>
            , or email{" "}
            <Link href="mailto:neil@savvo.app" className="text-[var(--copper)] hover:underline">
              neil@savvo.app
            </Link>{" "}
            with topics you want covered.
          </p>
        </footer>
      </div>
    </div>
  )
}
