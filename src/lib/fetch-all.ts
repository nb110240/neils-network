// ─── Read every row past the API row cap ───
// Supabase's REST API returns at most 1,000 rows per request (PostgREST
// db-max-rows), no matter what .limit() asks for. Any read that needs a
// user's whole network (dashboard, digest, exports, duplicate checks) must
// page through with .range(). Callers must order by a unique column so pages
// never overlap or skip rows.

export const PAGE_SIZE = 1000
/** Safety stop: a runaway loop must never hammer the database. */
export const MAX_ROWS = 100_000

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { pageSize = PAGE_SIZE, maxRows = MAX_ROWS }: { pageSize?: number; maxRows?: number } = {}
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, Math.min(from + pageSize, maxRows) - 1)
    if (error) return { data: rows, error }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return { data: rows, error: null }
}
