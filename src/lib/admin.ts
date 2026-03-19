const ADMIN_EMAILS = ["neilbajaj72@gmail.com"]

export function isAdmin(email: string | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email)
}
