import type { SupabaseClient } from "@supabase/supabase-js"
import { log } from "@/lib/logger"
import { apnsConfig, sendApns } from "./apns"
import { fcmServiceAccount, sendFcm } from "./fcm"
import type { PushMessage, PushPlatform } from "./types"

export function isPushConfigured(): boolean {
  return Boolean(apnsConfig() || fcmServiceAccount())
}

export interface UserPushResult {
  sent: number
  removed: number
  skipped?: "disabled" | "no_devices" | "not_configured"
}

/**
 * Sends a notification to every device registered to the user, unless they
 * turned push off. Deletes tokens the push services report as dead. Uses the
 * service-role client (push_tokens is not readable by users). Never throws:
 * a push is always a side effect of something that already succeeded.
 */
export async function sendPushToUser(
  service: SupabaseClient,
  userId: string,
  message: PushMessage,
  senders: { apns?: typeof sendApns; fcm?: typeof sendFcm } = {}
): Promise<UserPushResult> {
  try {
    if (!isPushConfigured()) return { sent: 0, removed: 0, skipped: "not_configured" }

    const [{ data: prefs }, { data: tokens, error }] = await Promise.all([
      service.from("user_preferences").select("push_enabled").eq("user_id", userId).maybeSingle(),
      service.from("push_tokens").select("token, platform").eq("user_id", userId),
    ])
    if (prefs && prefs.push_enabled === false) return { sent: 0, removed: 0, skipped: "disabled" }
    if (error || !tokens || tokens.length === 0) return { sent: 0, removed: 0, skipped: "no_devices" }

    const byPlatform = (platform: PushPlatform) =>
      (tokens as Array<{ token: string; platform: PushPlatform }>).filter((t) => t.platform === platform).map((t) => t.token)
    const [ios, android] = await Promise.all([
      (senders.apns ?? sendApns)(byPlatform("ios"), message),
      (senders.fcm ?? sendFcm)(byPlatform("android"), message),
    ])

    const dead = [...ios.deadTokens, ...android.deadTokens]
    if (dead.length > 0) {
      const { error: deleteError } = await service.from("push_tokens").delete().eq("user_id", userId).in("token", dead)
      if (deleteError) {
        log("error", "Failed to prune dead push tokens", { action: "push.prune", userId, error: deleteError.message })
      }
    }
    return { sent: ios.sent + android.sent, removed: dead.length }
  } catch (error) {
    log("error", "Push send failed", { action: "push.send", userId, error: error instanceof Error ? error.message : String(error) })
    return { sent: 0, removed: 0 }
  }
}
