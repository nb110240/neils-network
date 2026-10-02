import { describe, expect, it } from "vitest"
import { generateKeyPairSync, verify } from "node:crypto"
import { parseApplePrivateKey, signEs256Jwt } from "@/lib/apple/jwt"

function p8() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
  return { pem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), publicKey }
}

function decode(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"))
}

describe("signEs256Jwt", () => {
  it("produces a JWS that verifies with the key's public half", () => {
    const { pem, publicKey } = p8()
    const jwt = signEs256Jwt({ kid: "KEY123" }, { iss: "TEAM456", iat: 1700000000 }, parseApplePrivateKey(pem))
    const [head, body, sig] = jwt.split(".")
    expect(decode(head)).toEqual({ alg: "ES256", kid: "KEY123" })
    expect(decode(body)).toEqual({ iss: "TEAM456", iat: 1700000000 })
    // JWS ES256 signatures are raw r||s (64 bytes), not DER.
    expect(Buffer.from(sig, "base64url")).toHaveLength(64)
    expect(verify("sha256", Buffer.from(`${head}.${body}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"))).toBe(true)
  })
})

describe("parseApplePrivateKey", () => {
  it("accepts escaped newlines and a bare base64 body", () => {
    const { pem } = p8()
    expect(() => parseApplePrivateKey(pem.replace(/\n/g, "\\n"))).not.toThrow()
    const bare = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "")
    expect(() => parseApplePrivateKey(bare)).not.toThrow()
  })
})
