"use client"

import { useSyncExternalStore } from "react"
import { isNative } from "./capacitor"

const noSubscription = () => () => {}

/**
 * True inside the iOS/Android app. Always false during SSR and hydration's
 * first pass, so server and client markup match.
 */
export function useIsNative(): boolean {
  return useSyncExternalStore(noSubscription, isNative, () => false)
}
