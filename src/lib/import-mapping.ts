export const IMPORT_FIELDS = [
  { value: "skip", label: "Skip this column" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "job_title", label: "Job Title" },
  { value: "website", label: "Website" },
  { value: "how_we_met", label: "How We Met" },
  { value: "next_steps", label: "Next Steps" },
  { value: "last_contact_date", label: "Last Contact Date" },
  { value: "scheduled_follow_up", label: "Follow-Up Date" },
  { value: "investor_stage", label: "Raise Stage" },
  { value: "notes", label: "Notes" },
] as const

export const IMPORT_FIELD_VALUES = IMPORT_FIELDS.map((field) => field.value)

export function guessImportField(header: string): string {
  const h = header.toLowerCase().trim()
  if (h.includes("last contact") && (h.includes("date") || h === "last contact")) {
    return "last_contact_date"
  }
  if (
    (h.includes("next step") || h.includes("follow up") || h.includes("follow-up")) &&
    (h.includes("date") || h.includes("due"))
  ) {
    return "scheduled_follow_up"
  }
  // Pipeline status ("Status", "Stage", "Pipeline Stage"), but not
  // "Stage Focus" (the investor's preferred round, e.g. Seed).
  if (
    h === "status" ||
    h === "stage" ||
    h === "pipeline" ||
    h.includes("pipeline stage") ||
    h.includes("pipeline status") ||
    h.includes("deal stage") ||
    h.includes("raise stage")
  ) {
    return "investor_stage"
  }
  if (h.includes("name") && !h.includes("company")) return "name"
  if (h.includes("email") || h.includes("e-mail")) return "email"
  if (h.includes("phone") || h.includes("mobile") || h.includes("tel")) return "phone"
  if (
    h === "firm" ||
    h.includes("company") ||
    h.includes("organization") ||
    h.includes("org")
  ) return "company"
  if (h.includes("title") || h.includes("role") || h.includes("position") || h.includes("job")) {
    return "job_title"
  }
  if (h.includes("website") || h.includes("url") || h.includes("web")) return "website"
  if (h.includes("intro path") || h.includes("introduced by") || h.includes("how we met")) {
    return "how_we_met"
  }
  if (h.includes("next step") || h.includes("action") || h.includes("todo") || h.includes("follow")) {
    return "next_steps"
  }
  if (h.includes("note") || h.includes("comment") || h.includes("description") || h.includes("memo")) {
    return "notes"
  }
  return "skip"
}
