"use client"

import { useState, useEffect, useCallback } from "react"
import { Sun, Moon, Monitor } from "lucide-react"

const STORAGE_KEY = "savvo-theme"

type Theme = "light" | "dark" | "system"

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

function applyTheme(theme: Theme) {
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    document.documentElement.classList.toggle("dark", prefersDark)
  } else {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === "dark" || stored === "light") {
      setTheme(stored)
    } else {
      setTheme("system")
    }
    setMounted(true)
  }, [])

  const handleChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
    if (newTheme === "system") {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, newTheme)
    }
    applyTheme(newTheme)
  }, [])

  if (!mounted) return null

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Theme</p>
        <p className="text-xs text-muted-foreground mt-0.5">Choose how Savvo looks to you</p>
      </div>
      <div className="flex rounded-lg border p-1 gap-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => handleChange(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              theme === value
                ? "bg-[var(--copper)]/10 text-[var(--copper)]"
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
