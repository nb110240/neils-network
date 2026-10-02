"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { initNative } from "@/lib/native/capacitor"
import { useIsNative } from "@/lib/native/use-is-native"
import { forgetPushToken, initPushListeners, refreshPushRegistration } from "@/lib/native/push"
import { createClient } from "@/lib/supabase/client"
import { PushPrompt } from "@/components/push-prompt"

/**
 * Runs Capacitor native initialization once on mount, but ONLY inside the
 * native iOS/Android shell. On the web (normal browser or during SSR) the
 * isNative() guard short-circuits and this component renders nothing and does
 * nothing — web behavior is unchanged.
 *
 * Also keeps push registration tied to whoever is signed in: re-registers
 * the device on sign-in (tokens rotate) and forgets it on sign-out so the
 * next person on this phone never sees the previous account's alerts.
 */
export function NativeBootstrap() {
  const router = useRouter()
  const pathname = usePathname()
  const native = useIsNative()
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    if (!native) return
    void initNative()
    void initPushListeners((path) => router.push(path))

    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setSignedIn(false)
        void forgetPushToken()
        return
      }
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
        setSignedIn(true)
        void refreshPushRegistration()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [native, router])

  return native && signedIn && pathname === "/dashboard" ? <PushPrompt /> : null
}
