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
}

export interface SearchResult extends Contact {
  similarity?: number
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
