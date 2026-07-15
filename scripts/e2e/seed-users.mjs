// E2E persona seeding: creates pre-confirmed test users via the Supabase
// admin API so browser E2E can exercise login + every authenticated feature
// without the email-verification round trip.
//
// Run:    E2E_PASSWORD=<local-test-password> node --env-file=.env.local scripts/e2e/seed-users.mjs
// Clean:  node --env-file=.env.local scripts/e2e/cleanup-users.mjs
//
// Emails use @example.com (RFC 2606 reserved) so any digest/welcome sends
// bounce harmlessly and can never reach a real inbox.
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

export const E2E_USERS = [
  { email: "e2e-free-persona@example.com", label: "free" },
  { email: "e2e-pro-persona@example.com", label: "pro" },
]
// Keep the credential local. The seeded accounts are scoped by RLS, hold only
// synthetic data, and are deleted by cleanup-users.mjs at the end of the run.
export const E2E_PASSWORD = process.env.E2E_PASSWORD
if (!E2E_PASSWORD) {
  console.error("Missing E2E_PASSWORD")
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function findUserByEmail(email) {
  // listUsers is paginated; e2e users are few, one page is plenty.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw error
  return data.users.find((u) => u.email === email) ?? null
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())
if (isMain) {
  for (const { email, label } of E2E_USERS) {
    const existing = await findUserByEmail(email)
    if (existing) {
      console.log(`${label}: already exists ${existing.id} (${email})`)
      continue
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: E2E_PASSWORD,
      email_confirm: true,
    })
    if (error) {
      console.error(`${label}: FAILED to create ${email}: ${error.message}`)
      process.exit(1)
    }
    console.log(`${label}: created ${data.user.id} (${email})`)
  }
}
