import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"
import { log } from "@/lib/logger"

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

    // Delete the auth user (must be done separately — auth schema)
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(user.id)
    if (deleteError) {
      log("error", "Failed to delete auth user", { userId: user.id, action: "account.delete", route: "/api/settings/delete-account", error: deleteError.message })
      return errorResponse("Failed to delete account")
    }

    // Sign out the session
    await supabase.auth.signOut()

    log("info", "Account deleted", { userId: user.id, action: "account.delete", route: "/api/settings/delete-account" })

    return NextResponse.json({ success: true })
  } catch (error) {
    log("error", "Unhandled error deleting account", { action: "account.delete", route: "/api/settings/delete-account", error: String(error) })
    return errorResponse("Internal server error")
  }
}
