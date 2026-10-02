"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { X, ArrowRight, ArrowLeft } from "lucide-react"

export interface WalkthroughStep {
  /** CSS selector for the target element to highlight */
  target: string
  /** Tooltip title */
  title: string
  /** Tooltip description */
  description: string
  /** Preferred placement relative to target */
  placement?: "top" | "bottom" | "left" | "right"
  /** Optional action label instead of "Next" */
  actionLabel?: string
  /** Optional callback when this step is reached */
  onEnter?: () => void
}

interface WalkthroughProps {
  steps: WalkthroughStep[]
  /** localStorage key to persist completion */
  storageKey: string
  /** Called when walkthrough completes or is skipped */
  onComplete?: () => void
  /** Delay before starting (ms) */
  delay?: number
}

interface TooltipPosition {
  top: number
  left: number
  arrowSide: "top" | "bottom" | "left" | "right"
}

function getTooltipPosition(
  targetRect: DOMRect,
  placement: WalkthroughStep["placement"] = "bottom",
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPosition {
  const gap = 12
  const padding = 16

  let top = 0
  let left = 0
  let arrowSide: TooltipPosition["arrowSide"] = "top"

  switch (placement) {
    case "bottom":
      top = targetRect.bottom + gap
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
      arrowSide = "top"
      break
    case "top":
      top = targetRect.top - tooltipHeight - gap
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
      arrowSide = "bottom"
      break
    case "right":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
      left = targetRect.right + gap
      arrowSide = "left"
      break
    case "left":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
      left = targetRect.left - tooltipWidth - gap
      arrowSide = "right"
      break
  }

  // Clamp to viewport
  left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding))
  top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding))

  return { top, left, arrowSide }
}

export function Walkthrough({ steps, storageKey, onComplete, delay = 600 }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(-1) // -1 = not started
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Check if already completed
  useEffect(() => {
    if (typeof window === "undefined") return
    const completed = localStorage.getItem(storageKey)
    if (completed === "true") return

    const timer = setTimeout(() => {
      setCurrentStep(0)
    }, delay)
    return () => clearTimeout(timer)
  }, [storageKey, delay])

  // Position tooltip when step changes
  const positionTooltip = useCallback(() => {
    if (currentStep < 0 || currentStep >= steps.length) return

    const step = steps[currentStep]
    const el = document.querySelector(step.target)
    if (!el) {
      // Skip to next step if target not found
      if (currentStep < steps.length - 1) {
        setCurrentStep((s) => s + 1)
      } else {
        handleComplete()
      }
      return
    }

    const rect = el.getBoundingClientRect()
    setTargetRect(rect)

    // Scroll element into view if needed
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      // Re-measure after scroll
      setTimeout(() => {
        const newRect = el.getBoundingClientRect()
        setTargetRect(newRect)
        updateTooltipPos(newRect, step.placement)
      }, 400)
    } else {
      updateTooltipPos(rect, step.placement)
    }

    step.onEnter?.()

    // Fade in
    setTimeout(() => setIsVisible(true), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, steps])

  function updateTooltipPos(rect: DOMRect, placement: WalkthroughStep["placement"]) {
    const tooltipEl = tooltipRef.current
    const w = tooltipEl?.offsetWidth || 320
    const h = tooltipEl?.offsetHeight || 160
    setTooltipPos(getTooltipPosition(rect, placement, w, h))
  }

  useEffect(() => {
    positionTooltip()
  }, [positionTooltip])

  // Reposition on scroll/resize
  useEffect(() => {
    if (currentStep < 0) return

    const handleReposition = () => positionTooltip()
    window.addEventListener("scroll", handleReposition, true)
    window.addEventListener("resize", handleReposition)
    return () => {
      window.removeEventListener("scroll", handleReposition, true)
      window.removeEventListener("resize", handleReposition)
    }
  }, [currentStep, positionTooltip])

  function handleComplete() {
    setIsVisible(false)
    setCurrentStep(-1)
    localStorage.setItem(storageKey, "true")
    onComplete?.()
  }

  function goNext() {
    setIsVisible(false)
    setTimeout(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep((s) => s + 1)
      } else {
        handleComplete()
      }
    }, 150)
  }

  function goBack() {
    if (currentStep > 0) {
      setIsVisible(false)
      setTimeout(() => setCurrentStep((s) => s - 1), 150)
    }
  }

  if (currentStep < 0 || !targetRect) return null

  const step = steps[currentStep]
  const spotlightPad = 8

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Overlay with spotlight cutout using clip-path */}
      <div
        className="absolute inset-0 bg-black/50 transition-all duration-300"
        style={{
          clipPath: `polygon(
            0% 0%, 0% 100%,
            ${targetRect.left - spotlightPad}px 100%,
            ${targetRect.left - spotlightPad}px ${targetRect.top - spotlightPad}px,
            ${targetRect.right + spotlightPad}px ${targetRect.top - spotlightPad}px,
            ${targetRect.right + spotlightPad}px ${targetRect.bottom + spotlightPad}px,
            ${targetRect.left - spotlightPad}px ${targetRect.bottom + spotlightPad}px,
            ${targetRect.left - spotlightPad}px 100%,
            100% 100%, 100% 0%
          )`,
        }}
        onClick={handleComplete}
      />

      {/* Spotlight border ring */}
      <div
        className="absolute rounded-xl border-2 border-[var(--copper)]/60 pointer-events-none transition-all duration-300"
        style={{
          top: targetRect.top - spotlightPad,
          left: targetRect.left - spotlightPad,
          width: targetRect.width + spotlightPad * 2,
          height: targetRect.height + spotlightPad * 2,
          boxShadow: "0 0 0 4px rgba(194, 65, 12, 0.15)",
        }}
      />

      {/* Tooltip */}
      {tooltipPos && (
        <div
          ref={tooltipRef}
          className={`absolute z-[101] w-[320px] max-w-[calc(100vw-32px)] rounded-xl border bg-white dark:bg-stone-900 shadow-lg p-4 transition-all duration-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
          }`}
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
          }}
        >
          {/* Close button */}
          <button
            onClick={handleComplete}
            className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Step counter */}
          <div className="flex items-center gap-1.5 mb-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-5 bg-[var(--copper)]"
                    : i < currentStep
                      ? "w-1.5 bg-[var(--copper)]/40"
                      : "w-1.5 bg-stone-200 dark:bg-stone-700"
                }`}
              />
            ))}
          </div>

          <h3 className="text-sm font-semibold text-foreground mb-1 pr-6">{step.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.description}</p>

          <div className="flex items-center justify-between">
            <button
              onClick={handleComplete}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  className="h-7 px-2 text-xs"
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={goNext}
                variant="copper"
                className="h-7 px-3 text-xs"
              >
                {step.actionLabel || (currentStep === steps.length - 1 ? "Done" : "Next")}
                {currentStep < steps.length - 1 && <ArrowRight className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
