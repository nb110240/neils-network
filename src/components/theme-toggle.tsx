"use client"

import { useState, useEffect, useCallback } from "react"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "savvo-theme"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const dark = stored ? stored === "dark" : prefersDark

    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
    setMounted(true)
  }, [])

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle("dark", next)
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light")
      return next
    })
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground h-9 w-9 p-0">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="text-muted-foreground hover:text-foreground h-9 w-9 p-0"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
