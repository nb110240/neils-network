import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const read = (file: string) => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8")
const migration = read("20261001120000_growth_loops.sql")

function fn(name: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  expect(start, name).toBeGreaterThan(-1)
  return migration.slice(start, migration.indexOf("$$;", start))
}

describe("growth loops migration", () => {
  it("enables RLS with owner-only read policies on every new table", () => {
    for (const table of ["raise_snapshots", "referral_codes", "referrals", "pro_credits"]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }
    expect(migration).toContain("USING (auth.uid() = referrer_id)")
    // Referral and credit tables are read-only to users; writes go through functions.
    for (const table of ["referral_codes", "referrals", "pro_credits"]) {
      expect(migration).not.toMatch(new RegExp(`ON public\\.${table} FOR (INSERT|UPDATE|DELETE|ALL)`))
    }
  })

  it("keeps every SECURITY DEFINER function service-role only with a pinned search_path", () => {
    const definers = [...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([^)]*)\)[\s\S]*?SECURITY DEFINER\s*\n\s*SET search_path = ''/g)]
      .map((m) => m[1])
    expect(definers.sort()).toEqual([
      "claim_referral",
      "delete_user_account",
      "get_user_plan",
      "grant_referral_reward",
      "intro_request_for_token",
      "merge_owned_contacts",
      "raise_snapshot_summary",
      "respond_to_intro_request",
      "reward_referral_on_first_contact",
      "undo_owned_contact_merge",
    ])
    // Trigger-only, existing-grant (get_user_plan is called from the contact
    // limit trigger), and user-facing merge RPCs are checked separately.
    const serviceOnly = definers.filter((n) => ![
      "reward_referral_on_first_contact", "get_user_plan", "merge_owned_contacts", "undo_owned_contact_merge",
    ].includes(n))
    for (const name of serviceOnly) {
      expect(migration).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM anon`))
      expect(migration).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\) FROM authenticated`))
      expect(migration).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO service_role`))
    }
  })

  it("exposes only aggregate counts from the raise snapshot", () => {
    const summary = fn("raise_snapshot_summary")
    expect(summary).toContain("count(*)")
    expect(summary).toContain("c.archived_at IS NULL")
    expect(summary).not.toMatch(/c\.(name|company|email|raw_note)/)
  })

  it("never returns the requester's email on the public intro page", () => {
    const intro = fn("intro_request_for_token")
    expect(intro).not.toMatch(/u\.email|'email'/)
    expect(intro).toContain("target.archived_at IS NULL")
  })

  it("answers an intro link once, under a row lock", () => {
    const respond = fn("respond_to_intro_request")
    expect(respond).toContain("FOR UPDATE")
    expect(respond).toContain("connector_responded_at IS NOT NULL OR ir.status NOT IN ('draft', 'requested')")
    expect(respond).toContain("left(trim(COALESCE(p_note, '')), 1000)")
  })

  it("rewards each referral once, caps at 12 durably, and stacks after paid time", () => {
    const grant = fn("grant_referral_reward")
    expect(grant).toContain("status = 'signed_up'")
    expect(grant).toContain("FOR UPDATE")
    // Durable counter: deleting referred accounts must not reset the cap.
    expect(grant).toContain("SET rewards_granted = rewards_granted + 1")
    expect(grant).toContain("rewards_granted < 12")
    expect(grant).not.toMatch(/count\(\*\)[\s\S]*FROM public\.referrals/)
    expect(grant).toContain("GREATEST(now(), COALESCE(paid_until, now()), COALESCE(credit_until, now())) + interval '30 days'")
  })

  it("only claims new accounts and blocks self-referral", () => {
    const claim = fn("claim_referral")
    expect(claim).toContain("v_referrer = p_referred_user_id")
    expect(claim).toContain("interval '7 days'")
    expect(claim).toContain("ON CONFLICT (referred_user_id) DO NOTHING")
    expect(migration).toContain("CHECK (referrer_id <> referred_user_id)")
  })

  it("rewards on the first contact from any creation path", () => {
    expect(migration).toContain("AFTER INSERT ON public.contacts")
    expect(migration).toContain("EXECUTE FUNCTION public.reward_referral_on_first_contact()")
  })

  it("extends account deletion without dropping any earlier table", () => {
    const previous = read("20260717120000_raise_autopilot_core.sql")
    const prevBody = previous.slice(previous.lastIndexOf("CREATE OR REPLACE FUNCTION public.delete_user_account"))
    const tablesIn = (body: string) => new Set([...body.matchAll(/DELETE FROM public\.(\w+)/g)].map((m) => m[1]))
    const before = tablesIn(prevBody.slice(0, prevBody.indexOf("$$;")))
    const after = tablesIn(fn("delete_user_account"))
    for (const table of before) expect(after.has(table), table).toBe(true)
    for (const table of ["raise_snapshots", "referrals", "referral_codes", "pro_credits"]) {
      expect(after.has(table), table).toBe(true)
    }
    expect(fn("delete_user_account")).toContain("referrer_id = target_user_id OR referred_user_id = target_user_id")
  })

  it("constrains stages to the app's list", async () => {
    const { INVESTOR_STAGES } = await import("@/lib/investor-stage")
    for (const stage of INVESTOR_STAGES) expect(migration).toContain(`'${stage.value}'`)
  })

  it("counts referral credit as Pro in the DB contact-limit check", () => {
    const plan = fn("get_user_plan")
    expect(plan).toContain("FROM public.pro_credits WHERE user_id = uid AND pro_until > now()")
  })

  it("keeps the raise stage through merge and undo", () => {
    expect(fn("merge_owned_contacts")).toContain("investor_stage = COALESCE(keep_row.investor_stage, remove_row.investor_stage)")
    expect(fn("undo_owned_contact_merge")).toContain("investor_stage = log_row.kept_before->>'investor_stage'")
    // Copied verbatim otherwise: same ownership checks as the original.
    expect(fn("merge_owned_contacts")).toContain("created_by = auth.uid()")
  })

  it("hides an archived connector on the public intro page", () => {
    expect(fn("intro_request_for_token")).toContain("CASE WHEN connector.archived_at IS NULL THEN connector.name END")
  })
})
