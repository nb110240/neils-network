import { vi } from "vitest"

// ─── Mock Supabase client for testing ───
// Provides a chainable query builder that records operations
// and returns configurable responses.

interface MockQueryResult {
  data: unknown
  error: null | { message: string; code?: string }
  count?: number
}

export function createMockSupabase(overrides?: {
  queryResult?: MockQueryResult
  authUser?: { id: string; email?: string } | null
  rpcResult?: MockQueryResult
}) {
  const defaultResult: MockQueryResult = { data: null, error: null }
  const queryResult = overrides?.queryResult || defaultResult
  const rpcResult = overrides?.rpcResult || defaultResult

  // Chainable query builder
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(queryResult),
    maybeSingle: vi.fn().mockResolvedValue(queryResult),
    then: vi.fn((resolve: (value: MockQueryResult) => void) => resolve(queryResult)),
  }

  // Make the builder thenable (for await without .single())
  Object.defineProperty(queryBuilder, "then", {
    value: (resolve: (value: MockQueryResult) => void) => {
      return Promise.resolve(queryResult).then(resolve)
    },
    configurable: true,
  })

  const client = {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockResolvedValue(rpcResult),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: overrides?.authUser !== undefined
            ? overrides.authUser
            : { id: "test-user-id", email: "test@example.com" },
        },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    _queryBuilder: queryBuilder,
  }

  return client
}

// Convenience: mock for authenticated user
export function mockAuthenticatedClient(userId = "test-user-id", email = "test@example.com") {
  return createMockSupabase({
    authUser: { id: userId, email },
    queryResult: { data: [], error: null },
  })
}

// Convenience: mock for unauthenticated request
export function mockUnauthenticatedClient() {
  return createMockSupabase({ authUser: null })
}
