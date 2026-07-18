import { z } from "zod/v4"
import { normalizeMeetingText } from "@/lib/meeting-content"

const GRANOLA_API = "https://public-api.granola.ai/v1"

const NoteSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).passthrough()

const ListNotesSchema = z.object({
  notes: z.array(NoteSummarySchema),
  hasMore: z.boolean(),
  cursor: z.string().nullable(),
}).passthrough()

const NoteSchema = NoteSummarySchema.extend({
  owner: z.object({ name: z.string().nullable().optional(), email: z.string().email() }).passthrough(),
  summary_text: z.string(),
  summary_markdown: z.string().nullable(),
  attendees: z.array(z.object({
    name: z.string().nullable().optional(),
    email: z.string().email(),
  }).passthrough()),
  calendar_event: z.object({
    scheduled_start_time: z.string().datetime({ offset: true }).nullable().optional(),
  }).passthrough().nullable(),
  transcript: z.array(z.object({
    speaker: z.object({
      source: z.string().optional(),
      diarization_label: z.string().optional(),
    }).passthrough(),
    text: z.string(),
    start_time: z.string().datetime({ offset: true }).optional(),
    end_time: z.string().datetime({ offset: true }).optional(),
  }).passthrough()).nullable(),
}).passthrough()

export type GranolaNote = z.infer<typeof NoteSchema>

async function granolaFetch(apiKey: string, path: string): Promise<unknown> {
  const response = await fetch(`${GRANOLA_API}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500)
    const error = new Error(
      response.status === 401 || response.status === 403
        ? "Granola rejected this API key"
        : `Granola API returned ${response.status}${body ? `: ${body}` : ""}`
    )
    Object.assign(error, { status: response.status })
    throw error
  }
  return response.json()
}

export async function listGranolaNotes(apiKey: string, createdAfter?: string, pageSize = 10, cursor?: string) {
  const params = new URLSearchParams({ page_size: String(Math.min(30, Math.max(1, pageSize))) })
  if (createdAfter) params.set("created_after", createdAfter)
  if (cursor) params.set("cursor", cursor)
  return ListNotesSchema.parse(await granolaFetch(apiKey, `/notes?${params}`))
}

export async function getGranolaNote(apiKey: string, noteId: string): Promise<GranolaNote> {
  return NoteSchema.parse(await granolaFetch(apiKey, `/notes/${encodeURIComponent(noteId)}?include=transcript`))
}

export function granolaNoteToMeetingText(note: GranolaNote): string {
  const attendees = note.attendees
    .map((attendee) => [attendee.name, attendee.email].filter(Boolean).join(" <") + (attendee.name ? ">" : ""))
    .join(", ")
  const transcript = (note.transcript || [])
    .map((part) => {
      const speaker = part.speaker.diarization_label || part.speaker.source || "Speaker"
      return `${speaker}: ${part.text.trim()}`
    })
    .filter((line) => line.length > 2)
    .join("\n")

  return normalizeMeetingText([
    attendees ? `Attendees: ${attendees}` : "",
    note.summary_text ? `Summary:\n${note.summary_text}` : "",
    transcript ? `Transcript:\n${transcript}` : "",
  ].filter(Boolean).join("\n\n")).slice(0, 100000)
}
