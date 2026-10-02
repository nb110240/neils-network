"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/toast"
import { Turnstile } from "@/components/turnstile"
import { captureEvent } from "@/components/posthog-provider"
import { readReferralCodeFromDocument } from "@/lib/referrals"
import {
  attributionUserMetadata,
  getFirstTouchAttribution,
} from "@/lib/attribution"
import { Loader2, Mail, Eye, EyeOff } from "lucide-react"

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

// Pull the machine-readable error code off a Supabase AuthError (supabase-js
// v2.43+ sets `code`, e.g. "invalid_credentials", "captcha_failed").
function authErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "string") return code
  }
  return undefined
}

// Map Supabase auth error codes to human copy. Raw backend strings (for
// example "captcha protection: request disallowed (no captcha_token found)")
// must never reach the UI, so anything unmapped falls back to a generic
// message.
function friendlyAuthError(error: unknown): string {
  switch (authErrorCode(error)) {
    case "invalid_credentials":
      return "Wrong email or password"
    case "captcha_failed":
      return "Verification failed. Refresh and try again"
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again"
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the verification link"
    case "user_already_exists":
      return "An account with this email already exists. Try signing in instead"
    default:
      return "Something went wrong. Please try again"
  }
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const supabase = createClient()
  const { addToast } = useToast()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup")
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [email, setEmail] = useState("")
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  // Lightweight invalid-state check that fires only after the user leaves the
  // field. Catches obvious mistakes like "notanemail" without nagging while
  // they're still typing.
  const emailLooksInvalid =
    emailTouched &&
    email.length > 0 &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  const [signUpSent, setSignUpSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const resendIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current)
    }
  }, [])

  // Reset transient auth state whenever we switch between the sign-up /
  // sign-in / forgot-password / check-email views. Without this a revealed
  // password would re-render in plaintext after a view switch (credential
  // exposure on shared screens), a stale captcha token could enable submit
  // before a fresh Turnstile widget re-verifies, and a resend cooldown could
  // carry over to a corrected email.
  useEffect(() => {
    setShowPassword(false)
    setCaptchaToken(null)
    setCaptchaNonce((n) => n + 1)
    setFormError(null)
    setResendCooldown(0)
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current)
      resendIntervalRef.current = null
    }
  }, [isSignUp, isForgotPassword, signUpSent])

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Supabase captcha protection gates sign-in the same way it gates
    // sign-up, so both modes require a token when Turnstile is configured.
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setFormError("Please complete the verification check before continuing")
      return
    }

    setIsLoading(true)

    try {
      if (isSignUp) {
        const referralCode = readReferralCodeFromDocument()
        const firstTouchMetadata = {
          ...attributionUserMetadata(getFirstTouchAttribution()),
          ...(referralCode ? { referral_code: referralCode } : {}),
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            ...(Object.keys(firstTouchMetadata).length > 0
              ? { data: firstTouchMetadata }
              : {}),
            ...(captchaToken ? { captchaToken } : {}),
          },
        })
        if (error) throw error
        captureEvent("signup_completed", { method: "email" })
        setSignUpSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          ...(captchaToken ? { options: { captchaToken } } : {}),
        })
        if (error) throw error

        // MFA gate: if the user has a verified TOTP factor, Supabase
        // leaves the session at aal1 and asks us to challenge up to aal2
        // before letting them into the app.
        const { data: aal } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
          const { data: factorsData } = await supabase.auth.mfa.listFactors()
          const totp = factorsData?.totp?.find((f) => f.status === "verified")
          if (totp) {
            setMfaFactorId(totp.id)
            setIsLoading(false)
            return
          }
        }
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error) {
      // Persistent inline error with human copy only; never surface raw
      // backend text. Turnstile tokens are single-use, so clear the consumed
      // token and bump the nonce to reset the widget for the retry.
      setFormError(friendlyAuthError(error))
      setCaptchaToken(null)
      setCaptchaNonce((n) => n + 1)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaFactorId || mfaCode.length !== 6) return
    setIsLoading(true)
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challengeError) throw challengeError
      if (!challenge) throw new Error("Challenge failed")
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      })
      if (verifyError) throw verifyError
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      addToast({
        title: "Code didn't match",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
      setMfaCode("")
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Password recovery is also gated by Supabase captcha protection.
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setFormError("Please complete the verification check before continuing")
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(captchaToken ? { captchaToken } : {}),
      })
      if (error) throw error
      setResetSent(true)
    } catch (error) {
      setFormError(friendlyAuthError(error))
      setCaptchaToken(null)
      setCaptchaNonce((n) => n + 1)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    try {
      // Native (iOS): Google blocks OAuth in embedded WebViews, so run the
      // system-browser flow and exchange the code, rather than redirecting the
      // in-app WebView. No-op path on web falls through to the redirect below.
      const { isNative } = await import("@/lib/native/capacitor")
      if (isNative()) {
        const { signInWithGoogleNative } = await import("@/lib/native/google-auth")
        const result = await signInWithGoogleNative()
        if (!result.ok) {
          if (result.error && result.error !== "cancelled") {
            addToast({
              title: "Error",
              description: result.error,
              variant: "destructive",
            })
          }
          setIsLoading(false)
          return
        }
        router.push("/dashboard")
        router.refresh()
        return
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Google sign in failed",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const handleAppleAuth = async () => {
    setIsLoading(true)
    try {
      const { isNative } = await import("@/lib/native/capacitor")
      if (isNative()) {
        const { signInWithAppleNative } = await import("@/lib/native/apple-auth")
        const result = await signInWithAppleNative()
        if (!result.ok) {
          if (result.error && result.error !== "cancelled") {
            addToast({ title: "Error", description: result.error, variant: "destructive" })
          }
          setIsLoading(false)
          return
        }
        router.push("/dashboard")
        router.refresh()
        return
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          // ?provider=apple tells /auth/callback to keep Apple's refresh
          // token so account deletion can revoke it.
          redirectTo: `${window.location.origin}/auth/callback?provider=apple`,
        },
      })
      if (error) throw error
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Apple sign in failed",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  // MFA challenge view — shown after successful sign-in when the account
  // has a verified TOTP factor and the current session is still aal1.
  if (mfaFactorId) {
    return (
      <div className="animate-fade-in-scale">
        <Card className="shadow-refined-lg border-0 overflow-hidden">
          <CardHeader className="text-center pb-2">
            <h1 className="text-3xl font-normal tracking-tight text-stone-900 dark:text-stone-100">Two-step verification</h1>
            <CardDescription className="text-base mt-2">
              Enter the 6-digit code from your authenticator app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfa-code" className="text-sm font-medium">
                  Authentication code
                </Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  className="h-11 font-mono text-lg tracking-widest text-center"
                  autoFocus
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-base font-medium bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 transition-all shadow-md hover:shadow-lg border-0"
                disabled={isLoading || mfaCode.length !== 6}
              >
                {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Verify and sign in
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center pb-6">
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
                setMfaFactorId(null)
                setMfaCode("")
              }}
              className="text-sm text-muted-foreground hover:text-[var(--copper-text)] transition-colors font-medium"
            >
              Cancel and sign in as someone else
            </button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Sign-up confirmation view
  if (signUpSent) {
    return (
      <div className="animate-fade-in-scale">
        <Card className="shadow-refined-lg border-0 overflow-hidden">
          <CardHeader className="text-center pb-2">
            <h1 className="text-3xl font-normal tracking-tight text-stone-900 dark:text-stone-100">Check your email</h1>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                <Mail className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-lg font-medium">One last step to finish creating your Savvo account.</p>
              <p className="text-sm text-stone-700 dark:text-stone-300">
                We sent a confirmation link to <strong>{email}</strong>. Click it and you&apos;ll land straight in your dashboard, ready to add your first contact.
              </p>
              <div className="text-left text-xs text-stone-700 dark:text-stone-300 space-y-1.5 mt-2 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50">
                <p className="font-medium text-foreground">Can&apos;t find it?</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Check your <strong>spam or junk</strong> folder</li>
                  <li>Look for an email from <strong>hello@savvo.app</strong></li>
                  <li>The email may take up to 2 minutes to arrive</li>
                  <li>Still nothing? Use the resend button below</li>
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 pb-6">
            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center pb-2">
                <Turnstile
                  siteKey={TURNSTILE_SITE_KEY}
                  resetKey={captchaNonce}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsLoading(true)
                try {
                  // Resend is captcha-gated too. The confirmation screen has
                  // its own widget because the sign-up token was consumed.
                  const { error } = await supabase.auth.resend({
                    type: "signup",
                    email,
                    ...(captchaToken ? { options: { captchaToken } } : {}),
                  })
                  if (error) throw error
                  setCaptchaToken(null)
                  setCaptchaNonce((n) => n + 1)
                  addToast({ title: "Email resent", description: "Check your inbox for the confirmation link." })
                  if (resendIntervalRef.current) clearInterval(resendIntervalRef.current)
                  setResendCooldown(60)
                  resendIntervalRef.current = setInterval(() => {
                    setResendCooldown((prev) => {
                      if (prev <= 1) {
                        if (resendIntervalRef.current) clearInterval(resendIntervalRef.current)
                        resendIntervalRef.current = null
                        return 0
                      }
                      return prev - 1
                    })
                  }, 1000)
                } catch (error) {
                  setCaptchaToken(null)
                  setCaptchaNonce((n) => n + 1)
                  addToast({
                    title: "Couldn't resend the email",
                    description:
                      authErrorCode(error) === "captcha_failed"
                        ? "Verification failed. Complete the check and try again."
                        : "Something went wrong. Please try again in a moment.",
                    variant: "destructive",
                  })
                } finally {
                  setIsLoading(false)
                }
              }}
              disabled={
                isLoading ||
                resendCooldown > 0 ||
                (!!TURNSTILE_SITE_KEY && !captchaToken)
              }
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}
            </Button>
            <button
              type="button"
              onClick={() => { setSignUpSent(false); setIsSignUp(true) }}
              className="text-sm text-muted-foreground hover:text-[var(--copper-text)] transition-colors font-medium"
            >
              Wrong email? Go back and edit it
            </button>
            <button
              type="button"
              onClick={() => { setSignUpSent(false); setIsSignUp(false) }}
              className="text-sm text-muted-foreground hover:text-[var(--copper-text)] transition-colors font-medium"
            >
              Back to sign in
            </button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Forgot password view
  if (isForgotPassword) {
    return (
      <div className="animate-fade-in-scale">
        <Card className="shadow-refined-lg border-0 overflow-hidden">
          <CardHeader className="text-center pb-2">
            <h1 className="text-3xl font-normal tracking-tight text-stone-900 dark:text-stone-100">
              {resetSent ? "Check your email" : "Reset your password"}
            </h1>
            <CardDescription className="text-base mt-2">
              {resetSent
                ? "Check your email for a password reset link"
                : "Enter your email to reset your password"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative pt-2">
            {resetSent ? (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link to reset your password.
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    aria-invalid={emailLooksInvalid || undefined}
                    required
                    className={`h-11 transition-all focus:shadow-md ${
                      emailLooksInvalid
                        ? "border-red-500 focus-visible:ring-red-500"
                        : ""
                    }`}
                  />
                  {emailLooksInvalid && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Please enter a valid email address
                    </p>
                  )}
                </div>
                {TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center">
                    <Turnstile
                      siteKey={TURNSTILE_SITE_KEY}
                      resetKey={captchaNonce}
                      onVerify={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                    />
                  </div>
                )}
                {formError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300"
                  >
                    {formError}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 transition-all shadow-md hover:shadow-lg border-0"
                  disabled={isLoading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
                >
                  {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  Send Reset Link
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center pb-6 relative">
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false)
                setResetSent(false)
              }}
              className="text-sm text-muted-foreground hover:text-[var(--copper-text)] transition-colors font-medium"
            >
              Back to sign in
            </button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-scale">
      <Card className="shadow-refined-lg border-0 overflow-hidden">
        <CardHeader className="text-center pb-2">
          <h1 className="text-3xl font-normal tracking-tight text-stone-900 dark:text-stone-100">
            {isSignUp ? "Create your Savvo account" : "Welcome back"}
          </h1>
          <CardDescription className="text-base mt-2">
            {isSignUp
              ? "Keep every connection alive. Create your account."
              : "Welcome back. Sign in to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 relative pt-2">
          <Button
            className="w-full h-11 text-base font-medium bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 transition-all shadow-md hover:shadow-lg border-0"
            onClick={handleGoogleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--copper-text)]" />
              </span>
            ) : (
              <span className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
                </svg>
              </span>
            )}
            Continue with Google
          </Button>
          {/* Apple's guidelines: black button with white logo, white in dark mode, same size as other sign-in options. */}
          <Button
            className="w-full h-11 text-base font-medium border-0 bg-black text-white hover:bg-stone-900 dark:bg-white dark:text-black dark:hover:bg-stone-100 shadow-md"
            onClick={handleAppleAuth}
            disabled={isLoading}
          >
            <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28z" />
            </svg>
            Continue with Apple
          </Button>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--card)] px-3 text-stone-700 dark:text-stone-300 font-medium tracking-wider">
                or continue with email
              </span>
            </div>
          </div>
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                aria-invalid={emailLooksInvalid || undefined}
                required
                className={`h-11 transition-all focus:shadow-md ${
                  emailLooksInvalid
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
              />
              {emailLooksInvalid && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Please enter a valid email address
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs text-muted-foreground hover:text-[var(--copper-text)] transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  className="h-11 pr-12 transition-all focus:shadow-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-md text-stone-500 hover:text-[var(--copper-text)] dark:text-stone-400 dark:hover:text-[var(--copper-text)] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isSignUp && (
                <p className="text-xs text-muted-foreground">At least 6 characters</p>
              )}
            </div>
            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <Turnstile
                  siteKey={TURNSTILE_SITE_KEY}
                  resetKey={captchaNonce}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </div>
            )}
            {formError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300"
              >
                {formError}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 transition-all shadow-md hover:shadow-lg border-0"
              disabled={isLoading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
            >
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isSignUp ? "Create my free account" : "Sign In"}
            </Button>
            {isSignUp && (
              <p className="text-xs text-center text-stone-700 dark:text-stone-300">
                Free to start, no credit card. Your data stays private. No social scraping.
              </p>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex justify-center pb-6 relative">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-muted-foreground hover:text-[var(--copper-text)] transition-colors font-medium"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </CardFooter>
      </Card>
    </div>
  )
}
