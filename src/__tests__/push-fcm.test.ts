import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generateKeyPairSync, verify } from "node:crypto"
import { resetFcmTokenCache, sendFcm } from "@/lib/push/fcm"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const account = {
  project_id: "savvo-test",
  client_email: "push@savvo-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
}

type Reply = { status: number; body: unknown }

function fcmServer(sendReplies: Record<string, Reply> = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url)
    if (target === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }), { status: 200 })
    }
    const token = JSON.parse(String(init?.body)).message.token as string
    const reply = sendReplies[token] ?? { status: 200, body: { name: "projects/savvo-test/messages/1" } }
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  })
}

const message = { title: "Meeting notes to review", body: "2 meetings ready for your approval", url: "/inbox" }
const env = { ...process.env }

beforeEach(() => {
  resetFcmTokenCache()
  process.env.FCM_SERVICE_ACCOUNT = JSON.stringify(account)
})
afterEach(() => {
  process.env = { ...env }
})

describe("sendFcm", () => {
  it("authenticates with a signed service-account assertion and sends v1 messages", async () => {
    const fetchImpl = fcmServer()
    const result = await sendFcm(["tok-a", "tok-b"], message, fetchImpl)
    expect(result).toEqual({ sent: 2, failed: 0, deadTokens: [] })

    const [, tokenInit] = fetchImpl.mock.calls[0]
    const form = new URLSearchParams(String(tokenInit?.body))
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer")
    const [head, body, sig] = String(form.get("assertion")).split(".")
    const claims = JSON.parse(Buffer.from(body, "base64url").toString())
    expect(claims).toMatchObject({ iss: account.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token" })
    expect(verify("RSA-SHA256", Buffer.from(`${head}.${body}`), publicKey, Buffer.from(sig, "base64url"))).toBe(true)

    const [sendUrl, sendInit] = fetchImpl.mock.calls[1]
    expect(sendUrl).toBe("https://fcm.googleapis.com/v1/projects/savvo-test/messages:send")
    expect((sendInit?.headers as Record<string, string>).Authorization).toBe("Bearer ya29.test")
    expect(JSON.parse(String(sendInit?.body))).toEqual({
      message: {
        token: "tok-a",
        notification: { title: message.title, body: message.body },
        data: { url: "/inbox" },
        android: { priority: "high", ttl: "86400s", notification: {} },
      },
    })
  })

  it("reuses the access token across sends", async () => {
    const fetchImpl = fcmServer()
    await sendFcm(["tok-a"], message, fetchImpl)
    await sendFcm(["tok-b"], message, fetchImpl)
    const tokenCalls = fetchImpl.mock.calls.filter(([url]) => String(url).includes("oauth2"))
    expect(tokenCalls).toHaveLength(1)
  })

  it("marks unregistered tokens dead but not ones that hit a server error", async () => {
    const fetchImpl = fcmServer({
      gone: { status: 404, body: { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } } },
      stale: { status: 400, body: { error: { status: "INVALID_ARGUMENT", message: "The registration token is not a valid FCM registration token" } } },
      flaky: { status: 503, body: { error: { status: "UNAVAILABLE" } } },
    })
    const result = await sendFcm(["ok", "gone", "stale", "flaky"], message, fetchImpl)
    expect(result.sent).toBe(1)
    expect(result.deadTokens).toEqual(["gone", "stale"])
  })

  it("skips sending without a service account", async () => {
    delete process.env.FCM_SERVICE_ACCOUNT
    const fetchImpl = fcmServer()
    await expect(sendFcm(["tok-a"], message, fetchImpl)).resolves.toEqual({ sent: 0, failed: 1, deadTokens: [] })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
