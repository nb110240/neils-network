import Link from "next/link"
import { getPost } from "@/lib/blog-posts"
import { PostShell, postMetadata } from "../post-shell"

const post = getPost("how-many-investors-to-pitch-seed-round")

export const metadata = postMetadata(post)

export default function Page() {
  return (
    <PostShell post={post}>
      <p>
        The short answer: plan to contact <strong>50 to 100 investors</strong> and expect to
        take <strong>30 to 40 or more first meetings</strong> to close a typical seed round.
        That planning range is derived from published averages, not a promise for any individual
        round. This post walks through the numbers, the assumptions behind the funnel math, and
        factors that can move your ratios.
      </p>

      <h2>What the published data says</h2>
      <p>
        A useful public dataset on this comes from DocSend, the Dropbox-owned deck-sharing tool.
        In its{" "}
        <Link href="https://www.docsend.com/blog/seed-fundraising-round-in-2022-23/">
          2023 seed funding report
        </Link>
        , founders who raised a seed round contacted an average of <strong>66 investors</strong>,
        up from 48 in 2022. Meetings moved the other way: teams averaged{" "}
        <strong>38 investor meetings</strong> in 2023, down from 56 in 2022. In other words,
        founders had to reach out to more investors to get fewer meetings. The same report found
        that half of successful seed raises took <strong>13 to 24 weeks</strong> to close in
        2023, where a year earlier most wrapped inside 12 weeks (
        <Link href="https://www.prnewswire.com/news-releases/why-now-successful-founders-display-urgency-among-market-competition-in-docsends-annual-seed-report-302008136.html">
          DocSend annual seed report, 2023 data
        </Link>
        ).
      </p>
      <p>
        One stage earlier, the numbers are even bigger.{" "}
        <Link href="https://www.prnewswire.com/news-releases/from-growth-at-all-costs-to-cost-of-missing-out-docsend-pre-seed-report-shows-investor-shift-to-long-term-profitability-and-risk-aversion-301908433.html">
          DocSend&apos;s pre-seed report covering 2023
        </Link>{" "}
        found founders contacted an average of <strong>71 investors</strong> and secured{" "}
        <strong>46 meetings</strong>. About a third of successful pre-seed rounds took 13 to 18
        weeks to close, and companies that failed to raise kept grinding for around five months
        before stopping.
      </p>
      <p>
        Y Combinator&apos;s advice matches the data. Its{" "}
        <Link href="https://www.ycombinator.com/blog/how-to-raise-a-seed-round/">
          Guide to Seed Fundraising
        </Link>{" "}
        tells founders to &quot;meet as many investors as possible but focus on those most
        likely to close,&quot; and warns that &quot;investors have a lot of different ways to
        say no.&quot; The whole YC framing treats a raise as a parallel process across a wide
        list, not a sequence of hopeful one-off conversations.
      </p>
      <p>
        So if you are asking &quot;is it normal that I&apos;ve pitched 25 investors and
        don&apos;t have a term sheet,&quot; the answer is yes. On the averages, you are not even
        halfway to the 2023 average number of investors contacted in the DocSend sample.
      </p>

      <h2>The funnel math, step by step</h2>
      <p>
        A seed raise is a funnel with four stages. Here is how the stages relate, using the
        DocSend averages where data exists and clearly labeled assumptions where it does not.
      </p>
      <ul>
        <li>
          <strong>Target list to outreach.</strong> Not everyone on your list gets contacted.
          Some turn out to be wrong-stage, conflicted with a portfolio company, or unreachable.
          If you want to contact 66 investors, build a list of 80 to 100 names.
        </li>
        <li>
          <strong>Outreach to first meeting.</strong> The 2023 DocSend seed numbers, 66
          contacted to 38 meetings, imply that roughly <strong>6 in 10</strong> contacted
          investors took a meeting. Treat that as an upper bound: it reflects founders who
          eventually closed, and their lists leaned on warm intros. Cold outreach converts far
          lower.
        </li>
        <li>
          <strong>First meeting to term sheet.</strong> There is no reliable published
          conversion rate here, so do not trust anyone quoting one to two decimal places. A
          sane planning assumption is that a small single-digit percentage of first meetings
          becomes a lead check. If you assume 1 lead per 20 to 30 first meetings, the DocSend
          meeting averages suddenly make sense: 38 meetings is about what it takes to find one
          lead plus a few followers.
        </li>
        <li>
          <strong>Term sheet to closed round.</strong> A credible lead can give other investors
          a concrete reason to make a decision, but it does not guarantee that the rest of the
          round will fill. Keep every open conversation moving until funds are committed.
        </li>
      </ul>
      <p>
        Run backward from the goal: one lead needs 20 to 30 meetings, 30 meetings need roughly
        50 to 70 contacted investors at warm-intro conversion rates, and that needs a target
        list of 80 to 100. A list of 15 investors leaves very little room for wrong-fit targets,
        missed introductions, or ordinary rejection.
      </p>

      <h2>What changes the ratio</h2>
      <p>Three variables are worth considering when you adapt these averages to your round.</p>
      <ul>
        <li>
          <strong>Warm intros versus cold outreach.</strong> An intro from a founder the
          investor backed, or from another investor they trust, can convert differently from a
          cold email. Before outreach, map who you know that can connect you, and ask for concise,
          forwardable introductions.
        </li>
        <li>
          <strong>Traction.</strong>{" "}DocSend&apos;s pre-seed research found investors spent far
          more time on the traction section of successful decks in 2023 than in prior years.
          Real usage or revenue may improve conversion, but the report does not establish a
          fixed meetings-saved ratio. If you are pre-product, plan conservatively.
        </li>
        <li>
          <strong>Market conditions and heat.</strong>{" "}DocSend&apos;s 2021 and 2023 cohorts reported
          materially different outreach and meeting averages. You cannot control the market, but you can control
          concentration. Batching meetings into a tighter window can make it easier to compare
          feedback and keep your own process moving.
        </li>
      </ul>

      <h2>How to build a list big enough</h2>
      <p>
        If the data says 66 contacted investors is average, your job is a list of 80 to 100
        qualified names. Qualified means all four of these are true:
      </p>
      <ol>
        <li>They invest at your stage and typical check size.</li>
        <li>They have shown interest in your space, without a directly competitive portfolio company.</li>
        <li>They have made an investment in the last 12 months, so the fund is actually deploying.</li>
        <li>You can name a plausible path to them: a mutual founder, an investor you know, a community, or at worst a well-researched cold email.</li>
      </ol>
      <p>
        Sources: portfolio pages of funds at your stage, the investor lists of comparable (not
        competitive) companies one stage ahead of you, other founders&apos; recommendations, and
        the &quot;also participated&quot; names in funding announcements you wish were yours.
        Build the full list before you start pitching, then release it in waves so your best
        targets meet a rehearsed version of your pitch.
      </p>

      <h2>More outreach is not the goal</h2>
      <p>
        One caution before you blast a 300-name list: DocSend&apos;s own{" "}
        <Link href="https://www.docsend.com/blog/how-to-create-an-investor-strategy-for-your-pre-seed-fundraise/">
          pre-seed investor strategy research
        </Link>{" "}
        found only a weak correlation between the number of investors contacted and meetings
        held, and a weaker one still between contacts and dollars raised. Volume alone does not
        guarantee meetings or capital. Prioritize investors who actually invest at your stage
        and in your space instead of padding the list with scraped names. The
        numbers in this post are about having enough qualified at-bats, not about carpet
        bombing every fund with an email address.
      </p>

      <h2>The takeaway</h2>
      <p>
        Contact 50 to 100 investors. Expect 30 to 40 or more meetings. Budget three to six
        months. Some rounds close with far fewer pitches, but those outcomes are not a safe
        planning baseline. A broad, qualified process gives you more room for ordinary rejection,
        and disciplined tracking keeps avoidable follow-up gaps from narrowing it further.
      </p>
      <p>
        At this volume, tracking becomes the actual job: 40 open conversations means 40 next
        steps, objections, and follow-up dates to hold at once. Here is{" "}
        <Link href="/blog/how-to-track-investor-outreach-seed-round">
          the full system for tracking investor outreach during a seed round
        </Link>
        , and a free{" "}
        <Link href="/templates/investor-tracker">investor tracker template</Link> if you want to
        start in a spreadsheet today.
      </p>

      <h2>Sources</h2>
      <ul>
        <li>
          <Link href="https://www.docsend.com/blog/seed-fundraising-round-in-2022-23/">
            DocSend, &quot;Seed fundraising in 2023&quot;
          </Link>{" "}
          (2023 data: 66 investors contacted, 38 meetings, vs 48 and 56 in 2022)
        </li>
        <li>
          <Link href="https://www.prnewswire.com/news-releases/why-now-successful-founders-display-urgency-among-market-competition-in-docsends-annual-seed-report-302008136.html">
            DocSend annual seed report press release
          </Link>{" "}
          (2023 data: 50% of successful raises took 13 to 24 weeks)
        </li>
        <li>
          <Link href="https://www.prnewswire.com/news-releases/from-growth-at-all-costs-to-cost-of-missing-out-docsend-pre-seed-report-shows-investor-shift-to-long-term-profitability-and-risk-aversion-301908433.html">
            DocSend pre-seed report press release
          </Link>{" "}
          (2023 data: 71 contacted, 46 meetings, unsuccessful raises persisted about five months)
        </li>
        <li>
          <Link href="https://www.docsend.com/blog/how-to-create-an-investor-strategy-for-your-pre-seed-fundraise/">
            DocSend, &quot;How to Create an Investor Strategy for Your Pre-Seed Fundraise&quot;
          </Link>{" "}
          (weak correlation between outreach volume and meetings or dollars raised)
        </li>
        <li>
          <Link href="https://www.ycombinator.com/blog/how-to-raise-a-seed-round/">
            Y Combinator, &quot;A Guide to Seed Fundraising&quot; by Geoff Ralston
          </Link>{" "}
          (process guidance and quotes)
        </li>
      </ul>
    </PostShell>
  )
}
