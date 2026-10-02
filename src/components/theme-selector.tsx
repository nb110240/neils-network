"use client"

import { useState, useEffect, useCallback } from "react"
import { Sun, Moon, Monitor } from "lucide-react"
import { THEME_STORAGE_KEY, isDarkTheme, storedTheme, type Theme } from "@/lib/theme"

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  document.documentElement.classList.toggle("dark", isDarkTheme(theme, prefersDark))
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(storedTheme(localStorage.getItem(THEME_STORAGE_KEY)))
    setMounted(true)
  }, [])

  const handleChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  }, [])

  if (!mounted) return null

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Theme</p>
        <p className="text-xs text-muted-foreground mt-0.5">Choose how Savvo looks to you</p>
      </div>
      <div className="flex rounded-lg border p-1 gap-1" role="group" aria-label="Theme">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleChange(value)}
            aria-pressed={theme === value}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              theme === value
                ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
