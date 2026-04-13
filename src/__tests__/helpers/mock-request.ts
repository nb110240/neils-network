// ─── Request builder for testing API routes ───
// Creates mock Request objects with configurable method, body, headers.

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  url?: string
  searchParams?: Record<string, string>
}

export function buildRequest(options: RequestOptions = {}): Request {
  const {
    method = "GET",
    body,
    headers = {},
    url = "http://localhost:3001/api/test",
    searchParams,
  } = options

  let finalUrl = url
  if (searchParams) {
    const params = new URLSearchParams(searchParams)
    finalUrl = `${url}?${params.toString()}`
  }

  const init: RequestInit = { method, headers: new Headers(headers) }

  if (body !== undefined && method !== "GET") {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body)
    init.body = bodyStr
    if (!headers["content-type"]) {
      (init.headers as Headers).set("content-type", "application/json")
    }
    (init.headers as Headers).set("content-length", String(new Blob([bodyStr]).size))
  }

  return new Request(finalUrl, init)
}

// Convenience: POST request with JSON body
export function postRequest(url: string, body: unknown, headers?: Record<string, string>) {
  return buildRequest({ method: "POST", url, body, headers })
}

// Convenience: PUT request with JSON body
export function putRequest(url: string, body: unknown, headers?: Record<string, string>) {
  return buildRequest({ method: "PUT", url, body, headers })
}

// Convenience: DELETE request
export function deleteRequest(url: string, headers?: Record<string, string>) {
  return buildRequest({ method: "DELETE", url, headers })
}

// Convenience: GET request with optional search params
export function getRequest(url: string, searchParams?: Record<string, string>) {
  return buildRequest({ method: "GET", url, searchParams })
}

// Build a request with an oversized body
export function oversizedRequest(url: string, sizeBytes: number) {
  const body = "x".repeat(sizeBytes)
  return buildRequest({
    method: "POST",
    url,
    body,
    headers: { "content-type": "application/json" },
  })
}

// Build a request with a malicious body (for injection testing)
export function injectionRequest(url: string, payload: unknown) {
  return buildRequest({ method: "POST", url, body: payload })
}
