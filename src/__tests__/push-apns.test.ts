import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createServer, constants, type Http2Server, type IncomingHttpHeaders } from "node:http2"
import { generateKeyPairSync, verify } from "node:crypto"
import type { AddressInfo } from "node:net"
import { resetApnsTokenCache, sendApns } from "@/lib/push/apns"

// A real HTTP/2 server standing in for api.push.apple.com, so the test covers
// the actual transport, headers and status handling.
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
const received: Array<{ path: string; headers: IncomingHttpHeaders; body: string }> = []
const replies = new Map<string, { status: number; reason?: string }>()
let server: Http2Server
let host = ""

beforeAll(async () => {
  server = createServer()
  server.on("stream", (stream, headers) => {
    let body = ""
    stream.setEncoding("utf8")
    stream.on("data", (chunk: string) => (body += chunk))
    stream.on("end", () => {
      const path = String(headers[constants.HTTP2_HEADER_PATH])
      received.push({ path, headers, body })
      const token = path.split("/").pop() || ""
      const reply = replies.get(token) ?? { status: 200 }
      stream.respond({ ":status": reply.status, "content-type": "application/json" })
      stream.end(reply.reason ? JSON.stringify({ reason: reply.reason }) : "")
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

const env = { ...process.env }
beforeEach(() => {
  received.length = 0
  replies.clear()
  resetApnsTokenCache()
  process.env.APNS_KEY_ID = "APNSKEY123"
  process.env.APPLE_TEAM_ID = "TEAM456789"
  process.env.APNS_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n")
  process.env.APNS_HOST = host
})
afterEach(() => {
  process.env = { ...env }
})

const message = { title: "You promised Maya", body: "Send the deck", url: "/contact/c1", threadId: "daily-moves" }

describe("sendApns", () => {
  it("posts an alert to each device with a valid provider token", async () => {
    const result = await sendApns(["aaaa1111", "bbbb2222"], message)
    expect(result).toEqual({ sent: 2, failed: 0, deadTokens: [] })
    expect(received.map((r) => r.path)).toEqual(["/3/device/aaaa1111", "/3/device/bbbb2222"])

    const { headers, body } = received[0]
    expect(headers["apns-topic"]).toBe("app.savvo")
    expect(headers["apns-push-type"]).toBe("alert")
    expect(headers["apns-priority"]).toBe("10")
    expect(JSON.parse(body)).toEqual({
      aps: { alert: { title: "You promised Maya", body: "Send the deck" }, sound: "default", "thread-id": "daily-moves" },
      url: "/contact/c1",
    })

    const jwt = String(headers.authorization).replace(/^bearer /, "")
    const [head, claims, sig] = jwt.split(".")
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({ alg: "ES256", kid: "APNSKEY123" })
    expect(JSON.parse(Buffer.from(claims, "base64url").toString()).iss).toBe("TEAM456789")
    expect(verify("sha256", Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"))).toBe(true)
    // One provider token is reused for every request in the window.
    expect(received[1].headers.authorization).toBe(headers.authorization)
  })

  it("reports tokens Apple says are gone, and keeps ones that failed for other reasons", async () => {
    replies.set("dead410", { status: 410, reason: "Unregistered" })
    replies.set("badtoken", { status: 400, reason: "BadDeviceToken" })
    replies.set("busy", { status: 429, reason: "TooManyRequests" })
    const result = await sendApns(["ok1", "dead410", "badtoken", "busy"], message)
    expect(result.sent).toBe(1)
    expect(result.failed).toBe(3)
    expect(result.deadTokens).toEqual(["dead410", "badtoken"])
  })

  it("does nothing without APNs keys", async () => {
    delete process.env.APNS_KEY_ID
    const result = await sendApns(["aaaa1111"], message)
    expect(result).toEqual({ sent: 0, failed: 1, deadTokens: [] })
    expect(received).toHaveLength(0)
  })

  it("never throws when the server is unreachable", async () => {
    process.env.APNS_HOST = "http://127.0.0.1:1"
    await expect(sendApns(["aaaa1111"], message)).resolves.toEqual({ sent: 0, failed: 1, deadTokens: [] })
  })
})
