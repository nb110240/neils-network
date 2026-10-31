import Link from "next/link"
import { getPost } from "@/lib/blog-posts"
import { PostShell, postMetadata } from "../post-shell"

const post = getPost("how-to-track-investor-outreach-seed-round")

export const metadata = postMetadata(post)

export default function Page() {
  return (
    <PostShell post={post}>
      <p>
        A seed round is a sales process with one product, one buyer type, and a hard deadline:
        your runway. It is easy to treat it like a series of one-off conversations, but a
        disciplined process treats it like a pipeline. This guide covers a practical tracking
        system: how to build your target list, which statuses actually matter, what to
        write down after every meeting, and how to review the whole thing once a week without a
        team.
      </p>

      <h2>Build the target list in waves</h2>
      <p>
        Before you send a single email, build a qualified list. Based on the recent DocSend
        averages discussed in our <Link href="/blog/how-many-investors-to-pitch-seed-round">seed-round funnel guide</Link>,
        60 to 100 names is a useful planning range. Then split it into three waves.
      </p>
      <ul>
        <li>
          <strong>Wave 1: practice targets.</strong> 10 to 15 investors you would take money
          from but would not be your highest-priority targets. Use the early conversations to
          sharpen your answers and identify repeated objections before approaching your dream leads.
        </li>
        <li>
          <strong>Wave 2: the core.</strong> The 40 to 60 investors who are the realistic heart
          of your round. Right stage, right check size, some thesis overlap, and ideally a warm
          path to at least half of them. This wave goes out once your pitch and follow-up process
          feel consistent.
        </li>
        <li>
          <strong>Wave 3: the reach list.</strong>{" "}The name-brand funds and dream angels. Talk
          to them when you have momentum to report: meetings stacking up, a partner meeting
          scheduled, or a first commitment. A reach investor hearing &quot;we&apos;re 40 percent
          committed&quot; is a different conversation than a cold open.
        </li>
      </ul>
      <p>
        Waves matter because fundraising runs on momentum. If you email everyone at once, your
        best targets meet the worst version of your pitch, and your process leaks urgency
        everywhere at the same time.
      </p>

      <h2>Use statuses that mean something</h2>
      <p>
        Most founders track their raise with a status column that says things like
        &quot;talking&quot; or &quot;warm.&quot; Those are moods, not statuses. A status should
        tell you exactly what has to happen next and who owes the next move. Eight are enough:
      </p>
      <ol>
        <li><strong>To contact</strong>: on the list, no outreach yet.</li>
        <li><strong>Intro requested</strong>: you asked someone for a warm intro and are waiting.</li>
        <li><strong>Contacted</strong>: the email or intro went out, no reply yet.</li>
        <li><strong>Meeting booked</strong>: a date is on the calendar.</li>
        <li><strong>In process</strong>: met at least once, and there is a concrete next step with a date.</li>
        <li><strong>Partner meeting / diligence</strong>: the firm is doing real work on you.</li>
        <li><strong>Committed</strong>: verbal yes with an amount, or a signed term sheet.</li>
        <li><strong>Passed</strong>: a clear no, from them or from you.</li>
      </ol>
      <p>
        The rule that keeps this honest: <strong>every investor in statuses 4 through 6 must
        have a next step and a date attached.</strong>{" "}If you cannot name the next step, the
        deal is not &quot;in process,&quot; it is drifting. Drifting deals are where seed rounds
        go to die quietly.
      </p>

      <h2>The 48-hour follow-up rule</h2>
      <p>
        After every investor meeting, send a follow-up within 48 hours. Not a thank-you note. A
        working email that does three things: recaps the one or two points they reacted to,
        answers anything you promised to get back on, and proposes the specific next step with a
        date.
      </p>
      <p>
        Forty-eight hours is a workflow target, not a universal cutoff. It keeps the context
        fresh for you, leaves time to answer promised questions, and avoids turning a clear next
        step into an open-ended intention. If a warm meeting gets no reply to a direct ask within
        a week, record that as a signal rather than assuming the conversation is still moving.
      </p>
      <p>
        Same rule for intro requests. If a connector agreed to intro you and 48 hours pass,
        nudge them with a concise forwardable blurb. Making the next action easy removes avoidable
        friction without guessing why the intro has stalled.
      </p>

      <h2>What to log after every meeting</h2>
      <p>
        Write your notes within an hour of hanging up, while the details are still sharp. Four
        things, every time:
      </p>
      <ul>
        <li>
          <strong>Who said what.</strong>{" "}Which partner you met, what they pushed on, what made
          them lean in. Three months from now, &quot;met with Alta Ventures&quot; is useless;
          &quot;Sarah pushed hard on payback period, lit up at the pilot data&quot; is a script
          for the next meeting.
        </li>
        <li>
          <strong>The real objection versus the soft pass.</strong>{" "}&quot;Too early for us&quot;
          can be true, or it can be polite cover for &quot;I don&apos;t believe the market is
          big.&quot; Write down what you think the actual concern was, not just the words. If
          the same real objection shows up three times, that is not an investor problem, it is a
          pitch problem, and you can fix it mid-raise.
        </li>
        <li>
          <strong>The next step and its date.</strong>{" "}&quot;They want to see October revenue,
          call scheduled Nov 3&quot; is a next step. &quot;They said keep in touch&quot; is not.
          If a meeting truly ended without one, log that too. It is a signal.
        </li>
        <li>
          <strong>Who made the intro.</strong> You will want to update your connectors and thank
          them when the round closes. Keeping the source attached to the contact makes that
          follow-through much easier.
        </li>
      </ul>

      <h2>Run a weekly pipeline review, solo</h2>
      <p>
        Once a week, same day and time, spend 30 minutes reviewing the pipeline like a sales
        manager reviewing a rep. You are both people in this meeting. Ask five questions:
      </p>
      <ol>
        <li>Which investors have no next step or a next step with a past-due date? Fix each one today: follow up, or move them to Passed.</li>
        <li>How many first meetings did I get this week, and is that number rising or falling? Falling means feed the top: new outreach, new intro requests.</li>
        <li>What objection did I hear more than once? Decide the answer once, in writing, so next week you deliver it cleanly.</li>
        <li>Who has been sitting in the same status for two weeks or more? Stale is a status of its own; force the question or cut them.</li>
        <li>Do I have enough live conversations to close the round from here? If not, this week&apos;s job is list-building, not deck polish.</li>
      </ol>
      <p>
        This review converts a pile of anxious threads into a small list of concrete moves and
        exposes gaps before another week passes.
      </p>

      <h2>When to call a pass a pass</h2>
      <p>
        As Y Combinator&apos;s <Link href="https://www.ycombinator.com/blog/how-to-raise-a-seed-round/">seed fundraising guide</Link>{" "}
        notes, investors have many ways to say no. Phrases like &quot;keep us posted,&quot;
        &quot;a bit early for us,&quot; and &quot;circle back when you have a lead&quot; should not automatically stay live. Treating those as active deals
        wrecks your pipeline math and your morale. Call it a pass when any of these are true:
      </p>
      <ul>
        <li>Two direct asks for a next step, no reply, over two weeks.</li>
        <li>They asked for something, you delivered it, and silence followed for another week.</li>
        <li>&quot;Come back when you have a lead&quot; with no offer to do work in the meantime. That is a no with the door left decoratively open.</li>
      </ul>
      <p>
        Mark it Passed, note the stated and suspected reasons, and part warmly. A respectful close
        leaves room to return later with meaningful progress without treating a current no as a maybe.
      </p>

      <h2>Where to keep all this</h2>
      <p>
        A spreadsheet can hold the system above, and if that is what you have, use it. Grab our
        free <Link href="/templates/investor-tracker">investor tracker template</Link> and start
        today. The honest catch is that spreadsheets depend on you doing data entry at the worst
        possible moments: right after a pitch, between back-to-back meetings, or in a parking lot.
        That is when logging can slip, and an outdated tracker becomes hard to trust. This workflow is why{" "}
        <Link href="/">Savvo</Link> exists: you type what you remember the way you would text a
        friend, and contact details and next steps are extracted while follow-up nudges run automatically. If
        your sheet is already groaning, here is{" "}
        <Link href="/from-spreadsheet">how to switch without losing anything</Link>.
      </p>
      <p>
        Whatever tool you pick, the system is the point: list in waves, statuses with owners and
        dates, follow-ups inside 48 hours, real notes after every meeting, and one honest review
        a week. Wondering how big the list needs to be? See{" "}
        <Link href="/blog/how-many-investors-to-pitch-seed-round">
          how many investors you actually need to pitch to close a seed round
        </Link>
        .
      </p>
    </PostShell>
  )
}
