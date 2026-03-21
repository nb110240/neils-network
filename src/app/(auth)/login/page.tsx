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
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/toast"
import { Loader2, Mail } from "lucide-react"

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
  const [password, setPassword] = useState("")
  const [signUpSent, setSignUpSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const resendIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current)
    }
  }, [])

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setSignUpSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Authentication failed",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send reset link",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    try {
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

  // Sign-up confirmation view
  if (signUpSent) {
    return (
      <div className="animate-fade-in-scale">
        <Card className="shadow-refined-lg border-0 overflow-hidden">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-normal text-[var(--copper)]">Savvo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                <Mail className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-medium">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Click the link to verify your account and get started.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive it? Check your spam folder.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 pb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsLoading(true)
                try {
                  await supabase.auth.resend({ type: "signup", email })
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
                } catch {
                  addToast({ title: "Error", description: "Failed to resend email", variant: "destructive" })
                } finally {
                  setIsLoading(false)
                }
              }}
              disabled={isLoading || resendCooldown > 0}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}
            </Button>
            <button
              type="button"
              onClick={() => { setSignUpSent(false); setIsSignUp(false) }}
              className="text-sm text-muted-foreground hover:text-[var(--copper)] transition-colors font-medium"
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
            <CardTitle className="text-3xl font-normal text-[var(--copper)]">Savvo</CardTitle>
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
                    required
                    className="h-11 transition-all focus:shadow-md"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 transition-all shadow-md hover:shadow-lg border-0"
                  disabled={isLoading}
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
              className="text-sm text-muted-foreground hover:text-[var(--copper)] transition-colors font-medium"
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
          <CardTitle className="text-3xl font-normal text-[var(--copper)]">Savvo</CardTitle>
          <CardDescription className="text-base mt-2">
            {isSignUp
              ? "Keep every connection alive. Create your account."
              : "Welcome back. Sign in to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 relative pt-2">
          <Button
            variant="outline"
            className="w-full h-11 text-base font-medium transition-all hover:shadow-md hover:border-[var(--copper)]/30"
            onClick={handleGoogleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
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
            )}
            Continue with Google
          </Button>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--card)] px-3 text-muted-foreground font-medium tracking-wider">
                or
              </span>
            </div>
          </div>
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 transition-all focus:shadow-md"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs text-muted-foreground hover:text-[var(--copper)] transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 transition-all focus:shadow-md"
              />
              {isSignUp && (
                <p className="text-xs text-muted-foreground">At least 6 characters</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 transition-all shadow-md hover:shadow-lg border-0"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center pb-6 relative">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-muted-foreground hover:text-[var(--copper)] transition-colors font-medium"
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
