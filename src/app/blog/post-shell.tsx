import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SITE_URL, type BlogPost } from "@/lib/blog-posts"

export function postMetadata(post: BlogPost): Metadata {
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      type: "article",
      publishedTime: post.datePublished,
      authors: [post.author],
    },
  }
}

function articleJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.datePublished,
    dateModified: post.datePublished,
    url: `${SITE_URL}/blog/${post.slug}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    author: {
      "@type": "Person",
      name: post.author,
      sameAs: "https://x.com/neilbajaj",
    },
    publisher: {
      "@type": "Organization",
      name: "Savvo",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.svg`,
      },
    },
  }
}

export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function PostShell({ post, children }: { post: BlogPost; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(post)) }}
      />
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-stone-700 dark:text-stone-300 hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the blog
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-normal leading-tight font-[family-name:var(--font-dm-serif)] text-stone-900 dark:text-stone-100">
            {post.title}
          </h1>
          <p className="text-sm text-stone-700 dark:text-stone-300 mt-4">
            <span>{formatPostDate(post.datePublished)}</span>
            <span aria-hidden="true"> &middot; </span>
            <span>{post.readingMinutes} min read</span>
            <span aria-hidden="true"> &middot; </span>
            <Link href="https://x.com/neilbajaj" className="text-[var(--copper)] hover:underline">
              {post.author}
            </Link>
          </p>
        </header>

        <article
          className={[
            "space-y-5 text-base leading-relaxed text-stone-700 dark:text-stone-300",
            "[&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-normal [&_h2]:leading-snug [&_h2]:font-[family-name:var(--font-dm-serif)] [&_h2]:text-stone-900 dark:[&_h2]:text-stone-100",
            "[&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-stone-900 dark:[&_h3]:text-stone-100",
            "[&_a]:text-[var(--copper)] [&_a:hover]:underline",
            "[&_strong]:font-semibold [&_strong]:text-stone-900 dark:[&_strong]:text-stone-100",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2",
            "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--copper)]/40 [&_blockquote]:pl-4 [&_blockquote]:italic",
          ].join(" ")}
        >
          {children}
        </article>

        <footer className="mt-16 pt-8 border-t border-stone-200 dark:border-stone-800 text-sm text-stone-700 dark:text-stone-300 space-y-3">
          <p>
            Savvo is the investor CRM for founders raising a round. Type what you remember after
            every pitch and it tracks who you met, who is going cold, and who needs a
            follow-up.{" "}
            <Link href="/login?mode=signup" className="text-[var(--copper)] hover:underline">
              Start free with 50 contacts
            </Link>
            .
          </p>
          <p>
            Questions or corrections? Email{" "}
            <Link href="mailto:neil@savvo.app" className="text-[var(--copper)] hover:underline">
              neil@savvo.app
            </Link>{" "}
            or reach out on{" "}
            <Link href="https://x.com/neilbajaj" className="text-[var(--copper)] hover:underline">
              X
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  )
}
