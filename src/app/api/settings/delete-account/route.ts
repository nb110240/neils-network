import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const serviceSupabase = await createServiceClient()
    const userId = user.id

    // Delete all user data in order (respecting potential foreign keys)
    await serviceSupabase.from("digest_history").delete().eq("user_id", userId)
    await serviceSupabase.from("search_usage").delete().eq("user_id", userId)
    await serviceSupabase.from("integrations").delete().eq("user_id", userId)
    await serviceSupabase.from("contacts").delete().eq("created_by", userId)
    await serviceSupabase.from("subscriptions").delete().eq("user_id", userId)

    // Delete the auth user
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError)
      return NextResponse.json({ message: "Failed to delete account" }, { status: 500 })
    }

    // Sign out the session
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete account error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
