import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { createServiceClient } from "@/lib/supabase/server"

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
      console.error("Failed to delete user data:", rpcError)
      return errorResponse("Failed to delete account data")
    }

    // Delete the auth user (must be done separately — auth schema)
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError)
      return errorResponse("Failed to delete account")
    }

    // Sign out the session
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete account error:", error)
    return errorResponse("Internal server error")
  }
}
