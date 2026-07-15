// E2E persona cleanup: removes the seeded test users AND all their data.
// Uses the app's own delete_user_account(target_user_id) RPC first (it
// cleans owned rows across tables), then deletes the auth user. This
// mirrors the production delete-account flow, so it also exercises it.
//
// Run: node --env-file=.env.local scripts/e2e/cleanup-users.mjs
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const E2E_EMAILS = [
  "e2e-free-persona@example.com",
  "e2e-pro-persona@example.com",
  "e2e-delete-persona@example.com",
]

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
if (error) {
  console.error(`listUsers failed: ${error.message}`)
  process.exit(1)
}

let failures = 0
for (const email of E2E_EMAILS) {
  const user = data.users.find((u) => u.email === email)
  if (!user) {
    console.log(`skip: ${email} not found`)
    continue
  }
  const { error: rpcError } = await admin.rpc("delete_user_account", {
    target_user_id: user.id,
  })
  if (rpcError) {
    console.error(`data cleanup FAILED for ${email}: ${rpcError.message}`)
    failures++
    continue
  }
  const { error: delError } = await admin.auth.admin.deleteUser(user.id)
  if (delError) {
    console.error(`auth delete FAILED for ${email}: ${delError.message}`)
    failures++
    continue
  }
  console.log(`deleted: ${email} (${user.id})`)
}
process.exit(failures ? 1 : 0)
