#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import process from "node:process"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

const envPath = resolve(process.cwd(), ".env.local")
const fileEnv = existsSync(envPath) ? dotenv.parse(readFileSync(envPath)) : {}
const env = { ...fileEnv, ...process.env }

const url = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY."
  )
  process.exit(1)
}

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
}
const admin = createClient(url, serviceKey, clientOptions)

const runToken = `${Date.now()}-${randomBytes(4).toString("hex")}`
const password = randomBytes(32).toString("base64url")
const users = []

function check(condition, message) {
  if (!condition) throw new Error(message)
}

function dataOrThrow(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`)
  return result.data
}

async function createQaUser(label) {
  const email = `qa-raise-autopilot-${label}-${runToken}@example.com`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { qa_suite: "raise-autopilot-live" },
  })
  const user = dataOrThrow(created, `create ${label} QA user`).user
  check(user, `create ${label} QA user returned no user`)
  users.push(user.id)

  // Production CAPTCHA must remain enabled. Generate a one-time link through
  // the admin API, then redeem its token hash to obtain an ordinary user JWT
  // for the RLS checks without bypassing or weakening CAPTCHA configuration.
  const link = dataOrThrow(
    await admin.auth.admin.generateLink({ type: "magiclink", email }),
    `generate ${label} QA sign-in link`
  )
  check(link.properties?.hashed_token, `generate ${label} QA sign-in link returned no token`)

  const client = createClient(url, anonKey, clientOptions)
  dataOrThrow(
    await client.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties.hashed_token,
    }),
    `sign in ${label} QA user`
  )
  return { id: user.id, client }
}

async function cleanupUser(userId) {
  const cleanup = await admin.rpc("delete_user_account", {
    target_user_id: userId,
  })
  if (cleanup.error) {
    console.error(`QA data cleanup RPC failed: ${cleanup.error.message}`)
    return false
  }

  const authDelete = await admin.auth.admin.deleteUser(userId)
  if (authDelete.error && !/not found/i.test(authDelete.error.message)) {
    console.error(`QA auth cleanup failed: ${authDelete.error.message}`)
    return false
  }
  return true
}

async function assertNoOwnedRows(userId) {
  const checks = [
    ["after_call_reviews", "user_id"],
    ["commitments", "user_id"],
    ["inbound_aliases", "user_id"],
    ["usage_counters", "user_id"],
    ["investor_research_reports", "user_id"],
    ["intro_requests", "user_id"],
    ["contact_activities", "user_id"],
    ["merge_log", "user_id"],
    ["contacts", "created_by"],
    ["tags", "created_by"],
  ]

  for (const [table, ownerColumn] of checks) {
    const result = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(ownerColumn, userId)
    dataOrThrow(result, `verify cleanup for ${table}`)
    check(result.count === 0, `QA cleanup left ${result.count} row(s) in ${table}`)
  }
}

async function verifyAllowances(userId, userClient) {
  console.log("1/5 Verifying service-only free allowances...")

  const aiReservations = []
  for (let index = 0; index < 4; index += 1) {
    const result = await admin.rpc("reserve_free_ai_review", {
      target_user_id: userId,
      limit_count: 3,
    })
    aiReservations.push(dataOrThrow(result, "reserve free AI review"))
  }
  check(
    aiReservations.map((item) => item.allowed).join(",") === "true,true,true,false",
    "AI allowance did not enforce the lifetime limit atomically"
  )

  for (let index = 0; index < 3; index += 1) {
    dataOrThrow(
      await admin.rpc("refund_free_ai_review", { target_user_id: userId }),
      "refund free AI review"
    )
  }

  const csvAllowed = dataOrThrow(
    await admin.rpc("reserve_free_csv_contacts", {
      target_user_id: userId,
      requested_count: 5,
      limit_count: 5,
    }),
    "reserve five free CSV contacts"
  )
  const csvDenied = dataOrThrow(
    await admin.rpc("reserve_free_csv_contacts", {
      target_user_id: userId,
      requested_count: 1,
      limit_count: 5,
    }),
    "reject sixth free CSV contact"
  )
  check(csvAllowed.allowed && !csvDenied.allowed, "CSV allowance did not enforce five contacts")
  dataOrThrow(
    await admin.rpc("refund_free_csv_contacts", {
      target_user_id: userId,
      refund_count: 5,
    }),
    "refund free CSV contacts"
  )

  const unauthorized = await userClient.rpc("reserve_free_ai_review", {
    target_user_id: userId,
    limit_count: 3,
  })
  check(unauthorized.error, "Authenticated users can unexpectedly call the service-only allowance RPC")

  const counter = dataOrThrow(
    await admin
      .from("usage_counters")
      .select("ai_reviews_used, csv_contacts_imported")
      .eq("user_id", userId)
      .single(),
    "load refunded allowance counter"
  )
  check(
    counter.ai_reviews_used === 0 && counter.csv_contacts_imported === 0,
    "Allowance refunds did not restore the QA counter"
  )
}

async function verifyApproval(userId, userClient) {
  console.log("2/5 Verifying review approval, commitments, and retry safety...")

  const reviewId = randomUUID()
  const rawText = "Met Ada. I promised to send the deck tomorrow, and Ada will share diligence questions Friday."
  const inserted = await userClient
    .from("after_call_reviews")
    .insert({
      id: reviewId,
      user_id: userId,
      source: "manual",
      title: "QA investor meeting",
      raw_text: rawText,
      content_hash: createHash("sha256").update(rawText).digest("hex"),
      summary: "A productive investor meeting with two explicit commitments.",
      proposed_contact_patch: {
        name: "Ada QA Investor",
        email: `ada-${runToken}@example.com`,
        company: "QA Ventures",
      },
      proposed_commitments: [
        {
          direction: "user_owes",
          title: "Send the investor deck",
          priority: 95,
          confidence: 0.98,
        },
        {
          direction: "contact_owes",
          title: "Share diligence questions",
          priority: 70,
          confidence: 0.9,
        },
      ],
    })
    .select("id")
    .single()
  dataOrThrow(inserted, "insert pending review")

  const firstApproval = dataOrThrow(
    await userClient.rpc("approve_after_call_review", { p_review_id: reviewId }),
    "approve pending review"
  )
  check(firstApproval.contact_id, "Approval returned no contact")
  check(firstApproval.commitments_created === 2, "Approval did not create both commitments")
  check(firstApproval.already_approved === false, "First approval was incorrectly treated as a retry")

  const secondApproval = dataOrThrow(
    await userClient.rpc("approve_after_call_review", { p_review_id: reviewId }),
    "retry review approval"
  )
  check(secondApproval.already_approved === true, "Approval retry was not idempotent")

  const activityCount = await userClient
    .from("contact_activities")
    .select("*", { count: "exact", head: true })
    .eq("source_event_id", `review:${reviewId}`)
  dataOrThrow(activityCount, "count approval activities")
  check(activityCount.count === 1, "Approval retry duplicated the activity")

  const commitments = dataOrThrow(
    await userClient
      .from("commitments")
      .select("id, status, direction")
      .eq("review_id", reviewId),
    "load approved commitments"
  )
  check(commitments.length === 2, "Approval retry duplicated commitments")

  const commitmentId = commitments.find((item) => item.direction === "user_owes")?.id
  check(commitmentId, "User commitment was not created")
  const completedAt = new Date().toISOString()
  dataOrThrow(
    await userClient
      .from("commitments")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", commitmentId)
      .select("id")
      .single(),
    "complete commitment"
  )
  dataOrThrow(
    await userClient
      .from("commitments")
      .update({ status: "open", completed_at: null })
      .eq("id", commitmentId)
      .select("id")
      .single(),
    "reopen commitment"
  )

  return { reviewId, contactId: firstApproval.contact_id }
}

async function verifyMergeAndUndo(userId, userClient) {
  console.log("3/5 Verifying transactional contact merge and undo...")

  const contacts = dataOrThrow(
    await userClient
      .from("contacts")
      .insert([
        {
          name: "QA Keep Contact",
          raw_note: "Keep note",
          source: "qa_live_verifier",
          created_by: userId,
        },
        {
          name: "QA Remove Contact",
          email: `merge-${runToken}@example.com`,
          company: "Merge QA Co",
          raw_note: "Remove note",
          source: "qa_live_verifier",
          created_by: userId,
        },
      ])
      .select("id, email"),
    "insert merge contacts"
  )
  check(contacts.length === 2, "Merge QA contacts were not created")
  const keepId = contacts[0].id
  const removeId = contacts[1].id

  const activityId = randomUUID()
  dataOrThrow(
    await userClient.from("contact_activities").insert({
      id: activityId,
      contact_id: removeId,
      user_id: userId,
      type: "note",
      content: "QA merge child activity",
      source: "manual",
    }),
    "insert merge child activity"
  )

  const commitmentId = randomUUID()
  dataOrThrow(
    await userClient.from("commitments").insert({
      id: commitmentId,
      user_id: userId,
      contact_id: removeId,
      direction: "contact_owes",
      title: "QA merge child commitment",
    }),
    "insert merge child commitment"
  )

  const tag = dataOrThrow(
    await userClient
      .from("tags")
      .insert({ name: `QA merge ${runToken}`, created_by: userId })
      .select("id")
      .single(),
    "insert merge tag"
  )
  dataOrThrow(
    await userClient.from("contact_tags").insert({ contact_id: removeId, tag_id: tag.id }),
    "tag merge contact"
  )

  const introId = randomUUID()
  dataOrThrow(
    await userClient.from("intro_requests").insert({
      id: introId,
      user_id: userId,
      target_contact_id: keepId,
      connector_contact_id: removeId,
      reason: "QA merge intro path",
      draft_message: "Could you introduce us?",
    }),
    "insert merge intro request"
  )

  const merged = dataOrThrow(
    await userClient.rpc("merge_owned_contacts", {
      p_keep_id: keepId,
      p_remove_id: removeId,
    }),
    "merge contacts"
  )
  check(merged.mergeLogId, "Merge returned no undo log")

  const removedAfterMerge = dataOrThrow(
    await userClient
      .from("contacts")
      .select("archived_at")
      .eq("id", removeId)
      .single(),
    "load archived merged contact"
  )
  check(removedAfterMerge.archived_at, "Merge did not archive the removed contact")

  const keptAfterMerge = dataOrThrow(
    await userClient
      .from("contacts")
      .select("email")
      .eq("id", keepId)
      .single(),
    "load kept merged contact"
  )
  check(
    keptAfterMerge.email === `merge-${runToken}@example.com`,
    "Merge did not transfer the removed contact's email"
  )

  const movedActivity = dataOrThrow(
    await userClient
      .from("contact_activities")
      .select("contact_id")
      .eq("id", activityId)
      .single(),
    "load moved activity"
  )
  check(movedActivity.contact_id === keepId, "Merge did not move the child activity")

  const invalidatedPath = dataOrThrow(
    await userClient
      .from("intro_requests")
      .select("connector_contact_id, status")
      .eq("id", introId)
      .single(),
    "load invalidated intro path"
  )
  check(
    invalidatedPath.connector_contact_id === null && invalidatedPath.status === "draft",
    "Merge did not safely invalidate a self-referential intro path"
  )

  dataOrThrow(
    await userClient.rpc("undo_owned_contact_merge", {
      p_merge_log_id: merged.mergeLogId,
    }),
    "undo contact merge"
  )

  const removedAfterUndo = dataOrThrow(
    await userClient
      .from("contacts")
      .select("archived_at, email")
      .eq("id", removeId)
      .single(),
    "load restored contact"
  )
  check(removedAfterUndo.archived_at === null, "Undo did not restore the removed contact")
  check(
    removedAfterUndo.email === `merge-${runToken}@example.com`,
    "Undo did not restore the removed contact's email"
  )

  const keptAfterUndo = dataOrThrow(
    await userClient
      .from("contacts")
      .select("email")
      .eq("id", keepId)
      .single(),
    "load kept contact after undo"
  )
  check(keptAfterUndo.email === null, "Undo did not clear the email copied onto the kept contact")

  const restoredActivity = dataOrThrow(
    await userClient
      .from("contact_activities")
      .select("contact_id")
      .eq("id", activityId)
      .single(),
    "load restored activity"
  )
  check(restoredActivity.contact_id === removeId, "Undo did not restore the child activity")

  const restoredPath = dataOrThrow(
    await userClient
      .from("intro_requests")
      .select("connector_contact_id")
      .eq("id", introId)
      .single(),
    "load restored intro path"
  )
  check(restoredPath.connector_contact_id === removeId, "Undo did not restore the intro path")
}

async function verifyRls(primary, secondary, reviewId) {
  console.log("4/5 Verifying cross-account isolation...")

  const hiddenReview = dataOrThrow(
    await secondary.client
      .from("after_call_reviews")
      .select("id")
      .eq("id", reviewId),
    "query another account's review"
  )
  check(hiddenReview.length === 0, "RLS exposed another account's review")

  const foreignApproval = await secondary.client.rpc("approve_after_call_review", {
    p_review_id: reviewId,
  })
  check(foreignApproval.error, "Another account could approve the QA review")

  const hiddenContacts = dataOrThrow(
    await secondary.client
      .from("contacts")
      .select("id")
      .eq("created_by", primary.id),
    "query another account's contacts"
  )
  check(hiddenContacts.length === 0, "RLS exposed another account's contacts")
}

async function verifyAccountDeletion(primary) {
  console.log("5/5 Verifying exhaustive account-data cleanup...")
  dataOrThrow(
    await admin.rpc("delete_user_account", { target_user_id: primary.id }),
    "delete QA account data"
  )
  await assertNoOwnedRows(primary.id)
  dataOrThrow(await admin.auth.admin.deleteUser(primary.id), "delete primary QA auth user")
  users.splice(users.indexOf(primary.id), 1)
}

let exitCode = 0
try {
  const primary = await createQaUser("primary")
  const secondary = await createQaUser("secondary")

  await verifyAllowances(primary.id, primary.client)
  const approval = await verifyApproval(primary.id, primary.client)
  await verifyMergeAndUndo(primary.id, primary.client)
  await verifyRls(primary, secondary, approval.reviewId)
  await verifyAccountDeletion(primary)

  console.log("Raise Autopilot live database verification passed.")
} catch (error) {
  exitCode = 1
  console.error(error instanceof Error ? error.message : "Unknown live verification error")
} finally {
  let cleanupFailed = false
  for (const userId of [...users]) {
    if (!(await cleanupUser(userId))) cleanupFailed = true
  }
  if (cleanupFailed) {
    exitCode = 1
    console.error("QA cleanup was incomplete; investigate before another run.")
  } else {
    console.log("QA users and owned data removed.")
  }
}

process.exit(exitCode)
