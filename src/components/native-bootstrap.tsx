"use client"

import { useEffect } from "react"
import { initNative, isNative } from "@/lib/native/capacitor"

/**
 * Runs Capacitor native initialization once on mount, but ONLY inside the
 * native iOS/Android shell. On the web (normal browser or during SSR) the
 * isNative() guard short-circuits and this component renders nothing and does
 * nothing — web behavior is unchanged.
 */
export function NativeBootstrap() {
  useEffect(() => {
    if (!isNative()) return
    void initNative()
  }, [])

  return null
}
