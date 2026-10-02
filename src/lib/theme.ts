// ─── Theme ───
// Savvo is light-first: someone with no saved choice always gets light mode,
// whatever their device prefers. "System" is an explicit choice in Settings
// and is stored like the others. The boot script below runs before first
// paint and must agree exactly with ThemeSelector, so both come from here.

export const THEME_STORAGE_KEY = "savvo-theme"

export type Theme = "light" | "dark" | "system"

export function storedTheme(value: string | null): Theme {
  return value === "dark" || value === "system" ? value : "light"
}

export function isDarkTheme(theme: Theme, systemPrefersDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && systemPrefersDark)
}

/** Inline <head> script: applies the saved theme before first paint. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`
