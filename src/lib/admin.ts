function getAdminEmails(): string[] {
  const envVal = process.env.ADMIN_EMAILS
  if (!envVal) return []
  return envVal.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
}

export function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}
