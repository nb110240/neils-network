import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { scorePair, tierForScore, type ConfidenceTier } from "@/lib/dedup"

interface ContactRow {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  website: string | null
  last_contact_date: string | null
  created_at: string
  source: string | null
  embedding: number[] | null
}

interface GroupContact extends Omit<ContactRow, "embedding"> {
  source: string
}

interface DuplicateGroup {
  contacts: GroupContact[]
  reason: string
  score: number
  tier: ConfidenceTier
}

function canonicalPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function cluster(
  ids: string[],
  edges: Array<{ a: string; b: string }>
): Map<string, string[]> {
  const parent = new Map<string, string>()
  for (const id of ids) parent.set(id, id)

  function find(x: string): string {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root)!
    let cur = x
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }

  function union(a: string, b: string) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const { a, b } of edges) union(a, b)

  const clusters = new Map<string, string[]>()
  for (const id of ids) {
    const root = find(id)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(id)
  }
  return clusters
}

export async function GET() {
  try {
    const auth = await authenticateRequest("general")
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const { data: contactsRaw } = await supabase
      .from("contacts")
      .select(
        "id, name, email, phone, company, job_title, website, last_contact_date, created_at, source, embedding"
      )
      .eq("created_by", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })

    const contacts = (contactsRaw as ContactRow[] | null) ?? []
    if (contacts.length < 2) {
      return NextResponse.json({ groups: [] })
    }

    const { data: dismissedRows } = await supabase
      .from("not_duplicate_pairs")
      .select("contact_a_id, contact_b_id")
      .eq("user_id", user.id)

    const dismissed = new Set(
      (dismissedRows ?? []).map((r) => canonicalPairKey(r.contact_a_id, r.contact_b_id))
    )

    const byId = new Map<string, ContactRow>()
    for (const c of contacts) byId.set(c.id, c)

    const edges: Array<{ a: string; b: string; score: number; reason: string }> = []
    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const a = contacts[i]
        const b = contacts[j]
        const key = canonicalPairKey(a.id, b.id)
        if (dismissed.has(key)) continue
        const result = scorePair(a, b)
        if (result && result.score >= 0.5) {
          edges.push({ a: a.id, b: b.id, score: result.score, reason: result.reason })
        }
      }
    }

    if (edges.length === 0) {
      return NextResponse.json({ groups: [] })
    }

    const involved = new Set<string>()
    for (const e of edges) {
      involved.add(e.a)
      involved.add(e.b)
    }

    const clusters = cluster([...involved], edges)
    const bestEdgePerCluster = new Map<string, { score: number; reason: string }>()
    for (const e of edges) {
      const root = [...clusters.entries()].find(([, members]) => members.includes(e.a))?.[0]
      if (!root) continue
      const prev = bestEdgePerCluster.get(root)
      if (!prev || e.score > prev.score) {
        bestEdgePerCluster.set(root, { score: e.score, reason: e.reason })
      }
    }

    const groups: DuplicateGroup[] = []
    for (const [root, memberIds] of clusters) {
      if (memberIds.length < 2) continue
      const best = bestEdgePerCluster.get(root) ?? { score: 0.5, reason: "Potential duplicate" }
      const members = memberIds
        .map((id) => {
          const c = byId.get(id)
          if (!c) return null
          const { embedding: _embedding, ...rest } = c
          void _embedding
          return { ...rest, source: rest.source ?? "web" } as GroupContact
        })
        .filter((c): c is GroupContact => c !== null)
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      groups.push({
        contacts: members,
        reason: best.reason,
        score: best.score,
        tier: tierForScore(best.score),
      })
    }

    groups.sort((a, b) => b.score - a.score)

    return NextResponse.json({ groups })
  } catch (error) {
    console.error("Duplicate scan error:", error)
    return errorResponse("Failed to scan for duplicates")
  }
}
