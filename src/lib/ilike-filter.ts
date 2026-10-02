// ─── Safe "contains" filter for PostgREST .or() ───
// User text goes inside a double-quoted value, so commas, dots and
// parentheses can't break the filter syntax ("Acme, Inc" or "J. (Jay)").
// LIKE wildcards are escaped first so % and _ match literally.

/** `%text%` as a quoted PostgREST value, with LIKE wildcards escaped. */
export function quotedContainsPattern(text: string): string {
  const like = text.replace(/[%_\\]/g, (c) => `\\${c}`)
  return `"%${like.replace(/["\\]/g, (c) => `\\${c}`)}%"`
}

/** `.or()` argument matching rows where any of `fields` contains `text`. */
export function ilikeAnyFilter(fields: readonly string[], text: string): string {
  const value = quotedContainsPattern(text)
  return fields.map((field) => `${field}.ilike.${value}`).join(",")
}
