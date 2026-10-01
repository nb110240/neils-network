import { NextResponse } from "next/server"
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  isValidReferralCode,
} from "@/lib/referrals"

// Referral landing: remember the code for signup (claimed in
// /auth/callback) and land on the homepage tagged as referral traffic.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normalized = code.toLowerCase()
  const destination = new URL("/", request.url)
  destination.searchParams.set("utm_source", "referral")
  destination.searchParams.set("utm_medium", "referral")

  const response = NextResponse.redirect(destination)
  if (isValidReferralCode(normalized)) {
    response.cookies.set(REFERRAL_COOKIE, normalized, {
      // Readable by the signup form so the code also travels in user
      // metadata, for email confirmations opened on another device.
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      path: "/",
    })
  }
  return response
}
