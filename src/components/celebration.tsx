"use client"

import { useEffect, useState, useCallback } from "react"

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  angle: number
  velocity: number
  spin: number
  opacity: number
}

const COLORS = ["#c2410c", "#ea580c", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308"]

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 20,
    y: 40,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 8 + 4,
    angle: Math.random() * Math.PI * 2,
    velocity: Math.random() * 6 + 3,
    spin: (Math.random() - 0.5) * 10,
    opacity: 1,
  }))
}

interface CelebrationProps {
  /** Show celebration */
  show: boolean
  /** Called when animation completes */
  onComplete?: () => void
}

export function Celebration({ show, onComplete }: CelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [frame, setFrame] = useState(0)

  const animate = useCallback(() => {
    setFrame((f) => f + 1)
    setParticles((prev) =>
      prev
        .map((p) => ({
          ...p,
          x: p.x + Math.cos(p.angle) * p.velocity * 0.3,
          y: p.y + Math.sin(p.angle) * p.velocity * 0.3 + frame * 0.02,
          opacity: Math.max(0, p.opacity - 0.012),
          spin: p.spin,
        }))
        .filter((p) => p.opacity > 0)
    )
  }, [frame])

  useEffect(() => {
    if (!show) return
    setParticles(createParticles(60))
    setFrame(0)
  }, [show])

  useEffect(() => {
    if (particles.length === 0 && show) {
      onComplete?.()
      return
    }
    if (particles.length === 0) return

    const timer = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(timer)
  }, [particles, animate, show, onComplete])

  if (!show || particles.length === 0) return null

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: `rotate(${p.spin * frame}deg)`,
            transition: "none",
          }}
        />
      ))}
    </div>
  )
}

const CELEBRATION_STORAGE_KEY = "savvo-first-contact-celebrated"

/** Hook to manage first-contact celebration state */
export function useFirstContactCelebration() {
  const [showCelebration, setShowCelebration] = useState(false)

  /** Call after creating a contact — triggers celebration if it's the first one */
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
