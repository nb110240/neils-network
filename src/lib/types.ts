export interface Contact {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  website: string | null
  how_we_met: string | null
  next_steps: string | null
  follow_up_needed: boolean
  last_contact_date: string | null
  raw_note: string
  embedding?: number[]
  embedding_status: "pending" | "complete" | "failed"
  source: string
  created_by: string
  cadence_days: number | null
  scheduled_follow_up: string | null
  snoozed_until: string | null
  next_due_date: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface ContactActivity {
  id: string
  contact_id: string
  user_id: string
  type: "meeting" | "note" | "call" | "email" | "message" | "other"
  content: string
  occurred_at: string
  follow_up_needed: boolean
  created_at: string
}

export type ReviewSource = "manual" | "calendar" | "granola" | "forwarded_email"
export type ReviewStatus = "pending" | "approved" | "dismissed"
export type CommitmentDirection = "user_owes" | "contact_owes"
export type CommitmentStatus = "open" | "completed" | "snoozed" | "cancelled"
export type IntroRequestStatus = "draft" | "requested" | "accepted" | "introduced" | "meeting_booked" | "closed" | "declined"
export type IntroPathConfidence = "verified" | "possible" | "context_only"

export interface ProposedContactPatch {
  name?: string | null
  email?: string | null
  company?: string | null
  job_title?: string | null
  how_we_met?: string | null
  next_steps?: string | null
}

export interface ProposedCommitment {
  title: string
  direction: CommitmentDirection
  details: string | null
  due_at: string | null
  evidence: string | null
  confidence: number
  priority: number
}

export interface AfterCallReview {
  id: string
  user_id: string
  contact_id: string | null
  source: ReviewSource
  external_source_id: string | null
  title: string
  occurred_at: string
  raw_text: string
  content_hash: string
  summary: string
  proposed_contact_patch: ProposedContactPatch
  proposed_commitments: ProposedCommitment[]
  proposed_follow_up: string | null
  status: ReviewStatus
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface Commitment {
  id: string
  user_id: string
  contact_id: string
  source_activity_id: string | null
  review_id: string | null
  direction: CommitmentDirection
  title: string
  details: string | null
  due_at: string | null
  status: CommitmentStatus
  snoozed_until: string | null
  evidence: string | null
  confidence: number
  priority: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface IntroRequest {
  id: string
  user_id: string
  target_contact_id: string
  connector_contact_id: string | null
  status: IntroRequestStatus
  reason: string
  path_evidence: string | null
  path_confidence: IntroPathConfidence
  strength_score: number
  draft_message: string
  next_follow_up_at: string | null
  requested_at: string | null
  accepted_at: string | null
  introduced_at: string | null
  meeting_booked_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface ContactFormData {
  name?: string
  email?: string
  phone?: string
  company?: string
  job_title?: string
  website?: string
  how_we_met?: string
  next_steps?: string
  follow_up_needed?: boolean
  last_contact_date?: string
  cadence_days?: number | null
  scheduled_follow_up?: string | null
}

export interface SearchResult extends Contact {
  similarity?: number
  matchPercent?: number
}

export interface User {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

export interface DashboardStats {
  totalContacts: number
  followUpsNeeded: number
  recentContacts: Contact[]
}

// Health score types
export type HealthLevel = "green" | "yellow" | "orange" | "red"

export interface HealthScore {
  score: number
  level: HealthLevel
  label: string
}

// Subscription types
export type PlanType = "free" | "pro" | "team"

export const DAILY_DIGEST_PLANS: readonly PlanType[] = ["pro", "team"]

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: PlanType
  status: string
  current_period_end: string | null
  created_at: string
}

// Plan limits
export const PLAN_LIMITS = {
  free: {
    maxContacts: 50,
    canImport: false,
    canSemanticSearch: true,
    semanticSearchLimit: 5, // per month
    canDigest: true, // weekly only (Pro gets daily)
    canCalendarSync: false,
  },
  pro: {
    maxContacts: Infinity,
    canImport: true,
    canSemanticSearch: true,
    semanticSearchLimit: Infinity,
    canDigest: true,
    canCalendarSync: true,
  },
  team: {
    maxContacts: Infinity,
    canImport: true,
    canSemanticSearch: true,
    semanticSearchLimit: Infinity,
    canDigest: true,
    canCalendarSync: true,
  },
} as const

// Import types
export interface ImportColumnMapping {
  [csvColumn: string]: keyof ContactFormData | "skip"
}

export interface ImportPreview {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
}
