"use client"

import { useEffect, useState, useRef } from "react"

const COLORS = ["#c2410c", "#ea580c", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308"]
const PARTICLE_COUNT = 40

interface CelebrationProps {
  show: boolean
  onComplete?: () => void
}

export function Celebration({ show, onComplete }: CelebrationProps) {
  const [visible, setVisible] = useState(false)
  const particlesRef = useRef<{ x: number; y: number; color: string; size: number; angle: number; velocity: number; spin: number; delay: number }[]>([])

  useEffect(() => {
    if (!show) return
    // Generate particles once, animate entirely with CSS
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: 50 + (Math.random() - 0.5) * 20,
      y: 40,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 8 + 4,
      angle: Math.random() * 360,
      velocity: Math.random() * 300 + 150,
      spin: (Math.random() - 0.5) * 720,
      delay: Math.random() * 0.2,
    }))
    setVisible(true)

    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 2500)
    return () => clearTimeout(timer)
  }, [show, onComplete])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none" aria-hidden="true">
      {particlesRef.current.map((p, i) => {
        const dx = Math.cos((p.angle * Math.PI) / 180) * p.velocity
        const dy = Math.sin((p.angle * Math.PI) / 180) * p.velocity + 200
        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              animationName: "confetti-fall",
              animationDuration: "2.2s",
              animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              animationFillMode: "forwards",
              animationDelay: `${p.delay}s`,
              // @ts-expect-error CSS custom properties for per-particle animation
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              "--spin": `${p.spin}deg`,
            }}
          />
        )
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          80% { opacity: 0.8; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--spin)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

const CELEBRATION_STORAGE_KEY = "savvo-first-contact-celebrated"

/** Hook to manage first-contact celebration state */
export function useFirstContactCelebration() {
  const [showCelebration, setShowCelebration] = useState(false)

  function triggerIfFirst(contactCount: number) {
    if (typeof window === "undefined") return
    if (contactCount !== 1) return
    if (localStorage.getItem(CELEBRATION_STORAGE_KEY) === "true") return

    setShowCelebration(true)
    localStorage.setItem(CELEBRATION_STORAGE_KEY, "true")
  }

  function onComplete() {
    setShowCelebration(false)
  }

  return { showCelebration, triggerIfFirst, onComplete }
}
