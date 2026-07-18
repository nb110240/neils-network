#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import process from "node:process"
import dotenv from "dotenv"

const envPath = resolve(process.cwd(), ".env.local")
const fileEnv = existsSync(envPath)
  ? dotenv.parse(readFileSync(envPath))
  : {}
const env = { ...fileEnv, ...process.env }

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Set them in the environment or .env.local."
  )
  process.exit(1)
}

const requiredTables = {
  after_call_reviews: [
    "user_id",
    "contact_id",
    "source",
    "external_source_id",
    "proposed_contact_patch",
    "proposed_commitments",
    "status",
  ],
  commitments: [
    "user_id",
    "contact_id",
    "review_id",
    "direction",
    "due_at",
    "status",
  ],
  inbound_aliases: ["user_id", "alias_token", "enabled"],
  usage_counters: ["user_id", "ai_reviews_used", "csv_contacts_imported"],
  investor_research_reports: [
    "user_id",
    "contact_id",
    "identity_fingerprint",
    "citations",
    "model",
  ],
  intro_requests: [
    "user_id",
    "target_contact_id",
    "connector_contact_id",
    "status",
    "path_confidence",
    "draft_message",
  ],
  integrations: ["last_attempt_at", "last_sync_error"],
  merge_log: [
    "moved_commitment_ids",
    "moved_review_ids",
    "moved_research_ids",
    "intro_request_changes",
  ],
}

const requiredRpcs = [
  "approve_after_call_review",
  "merge_owned_contacts",
  "undo_owned_contact_merge",
  "reserve_free_ai_review",
  "refund_free_ai_review",
  "reserve_free_csv_contacts",
  "refund_free_csv_contacts",
]

function schemaMap(spec) {
  return spec.definitions ?? spec.components?.schemas ?? {}
}

function hasRpc(spec, name) {
  return Object.keys(spec.paths ?? {}).some(
    (path) => path === `/rpc/${name}` || path.endsWith(`/rpc/${name}`)
  )
}

async function loadOpenApi() {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/openapi+json",
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase schema request failed with HTTP ${response.status}`)
  }

  return response.json()
}

try {
  const spec = await loadOpenApi()
  const schemas = schemaMap(spec)
  const failures = []

  for (const [table, columns] of Object.entries(requiredTables)) {
    const tableSchema = schemas[table]
    if (!tableSchema) {
      failures.push(`missing table: ${table}`)
      continue
    }

    const properties = tableSchema.properties ?? {}
    for (const column of columns) {
      if (!(column in properties)) {
        failures.push(`missing column: ${table}.${column}`)
      }
    }
  }

  for (const rpc of requiredRpcs) {
    if (!hasRpc(spec, rpc)) {
      failures.push(`missing RPC: ${rpc}`)
    }
  }

  if (failures.length > 0) {
    console.error("Raise Autopilot schema verification failed:")
    for (const failure of failures) console.error(`- ${failure}`)
    console.error(
      "Apply supabase/migrations/20260717120000_raise_autopilot_core.sql, " +
        "wait for PostgREST to refresh its schema cache, and retry."
    )
    process.exit(1)
  }

  console.log(
    `Raise Autopilot schema verified: ${Object.keys(requiredTables).length} tables and ${requiredRpcs.length} RPCs are ready.`
  )
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unknown schema verification error"
  )
  process.exit(1)
}
