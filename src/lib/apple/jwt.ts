import { createPrivateKey, sign, type KeyObject } from "node:crypto"

// ES256 JSON Web Tokens signed with an Apple .p8 key. APNs uses them as
// provider tokens and Sign in with Apple uses them as client secrets.

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

/**
 * Accepts the .p8 file contents as stored in an env var: real newlines,
 * escaped "\n" sequences (common in dashboards), or the bare base64 body
 * without PEM armor.
 */
export function parseApplePrivateKey(raw: string): KeyObject {
  let pem = raw.trim().replace(/\\n/g, "\n")
  if (!pem.includes("BEGIN")) {
    const body = pem.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? ""
    pem = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`
  }
  return createPrivateKey(pem)
}

export function signEs256Jwt(
  header: { kid: string } & Record<string, unknown>,
  claims: Record<string, unknown>,
  key: KeyObject
): string {
  const head = base64url(JSON.stringify({ alg: "ES256", ...header }))
  const body = base64url(JSON.stringify(claims))
  const input = `${head}.${body}`
  // JWS wants the raw r||s signature, not the DER encoding Node defaults to.
  const signature = sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" })
  return `${input}.${base64url(signature)}`
}
