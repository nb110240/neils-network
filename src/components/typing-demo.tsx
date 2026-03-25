"use client"

import { useState, useEffect, useRef } from "react"

const DEMO_TEXT = `Met Sarah Chen at the Founders Dinner last night. She's a partner at Sequoia focused on B2B SaaS. We talked about the CRM space and she mentioned they're looking at AI-native tools. Should send her our deck next week.`

const EXTRACTED_FIELDS = [
  { label: "Name", value: "Sarah Chen" },
  { label: "Company", value: "Sequoia" },
  { label: "Role", value: "Partner, B2B SaaS" },
  { label: "How we met", value: "Founders Dinner" },
  { label: "Next step", value: "Send deck next week" },
  { label: "Follow-up", value: "Yes", highlight: true },
]

export function TypingDemo() {
  const [displayText, setDisplayText] = useState("")
  const [phase, setPhase] = useState<"typing" | "extracting" | "done" | "paused">("typing")
  const [visibleFields, setVisibleFields] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Start animation when component scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true)
        }
      },
      { threshold: 0.3 }
    )

    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [hasStarted])

  // Typing phase
  useEffect(() => {
    if (!hasStarted || phase !== "typing") return

    if (displayText.length < DEMO_TEXT.length) {
      const speed = Math.random() * 20 + 15 // 15-35ms per char
      const timer = setTimeout(() => {
        setDisplayText(DEMO_TEXT.slice(0, displayText.length + 1))
      }, speed)
      return () => clearTimeout(timer)
    } else {
      // Done typing, pause then extract
      const timer = setTimeout(() => setPhase("extracting"), 600)
      return () => clearTimeout(timer)
    }
  }, [hasStarted, phase, displayText])

  // Extraction phase — reveal fields one by one
  useEffect(() => {
    if (phase !== "extracting") return

    if (visibleFields < EXTRACTED_FIELDS.length) {
      const timer = setTimeout(() => {
        setVisibleFields((v) => v + 1)
      }, 200)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => setPhase("done"), 1000)
      return () => clearTimeout(timer)
    }
  }, [phase, visibleFields])

  // Reset and loop after pause
  useEffect(() => {
    if (phase !== "done") return
    const timer = setTimeout(() => {
      setDisplayText("")
      setVisibleFields(0)
      setPhase("paused")
      // Brief pause then restart
      setTimeout(() => setPhase("typing"), 1500)
    }, 4000)
    return () => clearTimeout(timer)
  }, [phase])

  return (
    <div ref={containerRef} className="rounded-2xl border shadow-refined p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Add Contact</h3>
        <span className="text-xs text-muted-foreground">Just type what you remember</span>
      </div>
      <div className="space-y-3">
        {/* Typing area */}
        <div className="rounded-lg border p-3 text-sm leading-relaxed min-h-[100px] relative">
          {displayText ? (
            <span className="text-stone-700 dark:text-stone-300">
              {displayText}
              {phase === "typing" && (
                <span className="inline-block w-0.5 h-4 bg-[var(--copper)] ml-0.5 animate-pulse align-text-bottom" />
              )}
            </span>
          ) : (
            <span className="text-muted-foreground italic">
              Describe who you met...
              {phase === "paused" && (
                <span className="inline-block w-0.5 h-4 bg-[var(--copper)] ml-0.5 animate-pulse align-text-bottom" />
              )}
            </span>
          )}
        </div>

        {/* Extraction indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {phase === "typing" || phase === "paused"
              ? "↓ AI extracts automatically"
              : phase === "extracting"
                ? "✨ Extracting..."
                : "✓ Extracted"
            }
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Extracted fields */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
          {EXTRACTED_FIELDS.map((field, i) => (
            <div
              key={field.label}
              className={`flex justify-between transition-all duration-300 ${
                i < visibleFields
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1"
              }`}
            >
              <span className="text-muted-foreground">{field.label}</span>
              <span className={field.highlight ? "text-amber-600 font-medium" : "font-medium"}>
                {i < visibleFields ? field.value : "—"}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground pt-1">
          No forms. No fields. Just write what you&apos;d text a friend — AI handles the rest in seconds.
        </p>
      </div>
    </div>
  )
}
