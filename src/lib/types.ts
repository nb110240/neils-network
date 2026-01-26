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
  source: string
  created_by: string
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
