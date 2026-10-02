import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"
import { log } from "@/lib/logger"
import { auditAccountDeletion } from "@/lib/audit"
import { isAppleSignInConfigured, revokeAppleToken } from "@/lib/apple/sign-in"

async function revokeAppleSignIn(service: Awaited<ReturnType<typeof createServiceClient>>, userId: string) {
  try {
    const { data } = await service
      .from("apple_sign_in_tokens")
      .select("client_id, refresh_token")
      .eq("user_id", userId)
      .maybeSingle()
    if (!data) return
    if (!isAppleSignInConfigured()) {
      log("warn", "Apple token not revoked: Sign in with Apple keys are not configured", { userId, action: "account.delete", route: "/api/settings/delete-account" })
      return
    }
    await revokeAppleToken(data.refresh_token, data.client_id)
  } catch (error) {
    log("error", "Failed to revoke Apple token", { userId, action: "account.delete", route: "/api/settings/delete-account", error: error instanceof Error ? error.message : String(error) })
  }
}

export async function DELETE() {
  try {
    const auth = await authenticateRequest()
    if (authFailed(auth)) return auth.error
    const { user, supabase } = auth

    const serviceSupabase = await createServiceClient()

    // Delete all user data atomically via RPC (runs in a single transaction)
    const { error: rpcError } = await serviceSupabase.rpc("delete_user_account", {
      target_user_id: user.id,
    })

    if (rpcError) {
      log("error", "Failed to delete user data", { userId: user.id, action: "account.delete", route: "/api/settings/delete-account", error: rpcError.message })
      return errorResponse("Failed to delete account data")
    }

    // Older deployed versions of delete_user_account() predate these tables.
    // Delete them defensively before removing auth.users so an account can be
    // deleted even while the database function is catching up to the schema.
    const residualDeletes = await Promise.all([
      serviceSupabase.from("user_preferences").delete().eq("user_id", user.id),
      serviceSupabase.from("tags").delete().eq("created_by", user.id),
    ])
    const residualError = residualDeletes.find(({ error }) => error)?.error
    if (residualError) {
      log("error", "Failed to delete residual user data", { userId: user.id, action: "account.delete", route: "/api/settings/delete-account", error: residualError.message })
      return errorResponse("Failed to delete account data")
    }

    // Sign in with Apple accounts: revoke Apple's token before the row
    // disappears with the user (App Review guideline 5.1.1(v)). A failed
    // revoke must not block deletion; Apple also drops the link on its side
    // once the token is unused.
    await revokeAppleSignIn(serviceSupabase, user.id)

    // Delete the auth user (must be done separately — auth schema)
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(user.id)
    if (deleteError) {
      log("error", "Failed to delete auth user", { userId: user.id, action: "account.delete", route: "/api/settings/delete-account", error: deleteError.message })
      return errorResponse("Failed to delete account")
    }

    // Sign out the session
    await supabase.auth.signOut()

    auditAccountDeletion(user.id)
    log("info", "Account deleted", { userId: user.id, action: "account.delete", route: "/api/settings/delete-account" })

    return NextResponse.json({ success: true })
  } catch (error) {
    log("error", "Unhandled error deleting account", { action: "account.delete", route: "/api/settings/delete-account", error: String(error) })
    return errorResponse("Internal server error")
  }
}
