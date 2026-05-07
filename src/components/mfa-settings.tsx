"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { ShieldCheck, ShieldOff, Loader2, Check, X } from "lucide-react"

interface Factor {
  id: string
  friendly_name?: string
  factor_type: "totp" | "phone"
  status: "verified" | "unverified"
  created_at: string
}

interface EnrollmentState {
  factorId: string
  qrCodeSvg: string
  secret: string
}

export function MfaSettings() {
  const { addToast } = useToast()
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null)
  const [friendlyName, setFriendlyName] = useState("Authenticator")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      addToast({
        title: "Couldn't load 2FA settings",
        description: "Refresh the page and try again.",
        variant: "destructive",
      })
      setFactors([])
    } else {
      const all = [...(data?.totp ?? []), ...(data?.phone ?? [])] as Factor[]
      setFactors(all)
    }
    setLoading(false)
  }, [addToast])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function startEnroll() {
    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: friendlyName || "Authenticator",
      })
      if (error) throw error
      if (!data) throw new Error("Enrollment failed")
      setEnrollment({
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
      })
    } catch (err) {
      addToast({
        title: "Couldn't start 2FA setup",
        description: "Sign out, sign back in, and try again.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  async function verifyEnroll() {
    if (!enrollment || code.length !== 6) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enrollment.factorId })
      if (challengeError) throw challengeError
      if (!challengeData) throw new Error("Challenge failed")

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challengeData.id,
        code,
      })
      if (verifyError) throw verifyError

      addToast({
        title: "Two-factor authentication enabled",
        description: "You'll be asked for a code the next time you sign in.",
      })
      setEnrollment(null)
      setCode("")
      refresh()
    } catch (err) {
      addToast({
        title: "Code didn't match",
        description: "Make sure your authenticator app is showing the latest code, then try again.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  async function cancelEnroll() {
    if (!enrollment) return
    setBusy(true)
    try {
      const supabase = createClient()
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId })
    } finally {
      setEnrollment(null)
      setCode("")
      setBusy(false)
    }
  }

  async function removeFactor(factorId: string) {
    if (!confirm("Remove this authenticator? You'll no longer be prompted for a code at sign-in.")) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      addToast({ title: "2FA removed" })
      refresh()
    } catch (err) {
      addToast({
        title: "Couldn't remove 2FA",
        description: "Refresh the page and try again.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const verified = factors.filter((f) => f.status === "verified")

  return (
    <Card className="shadow-refined">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-normal">
          {verified.length > 0 ? (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          ) : (
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          )}
          Two-factor authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading...
          </div>
        ) : enrollment ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm mb-2">
                Scan this QR code with your authenticator app (1Password, Authy, Google Authenticator, etc.), then enter the 6-digit code it shows.
              </p>
              <div
                className="inline-block rounded-lg bg-white p-3 border border-stone-200"
                dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Can't scan? Enter this code manually:{" "}
                <code className="font-mono text-xs bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                  {enrollment.secret}
                </code>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">6-digit code</label>
              <Input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="font-mono text-lg tracking-widest max-w-[180px]"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyEnroll} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Verify and enable
              </Button>
              <Button variant="outline" onClick={cancelEnroll} disabled={busy}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        ) : verified.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Two-factor authentication is enabled. You'll be prompted for a code at sign-in.
            </p>
            {verified.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {f.friendly_name || f.factor_type.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeFactor(f.id)}
                  disabled={busy}
                  className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add a second factor to protect your account. You'll enter a 6-digit code from your authenticator app after signing in.
            </p>
            <div className="space-y-2 max-w-sm">
              <label className="text-xs font-medium text-muted-foreground">Device name (optional)</label>
              <Input
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                placeholder="Authenticator"
              />
            </div>
            <Button onClick={startEnroll} disabled={busy} variant="outline">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Enable 2FA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
