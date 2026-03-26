"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Loader2,
  User,
  Lock,
  Crown,
  Mail,
  Lightbulb,
  Check,
  AlertTriangle,
  Bell,
  Sun,
} from "lucide-react"
import { NotificationPreferences } from "./notifications"
import { ThemeSelector } from "@/components/theme-selector"
import { RecentlyDeleted } from "@/components/recently-deleted"

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { addToast } = useToast()

  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [isPlanLoading, setIsPlanLoading] = useState(false)
  const [plan, setPlan] = useState<string>("free")
  const [contactCount, setContactCount] = useState(0)
  const [featureRequest, setFeatureRequest] = useState("")
  const [isFeatureLoading, setIsFeatureLoading] = useState(false)
  const [featureSent, setFeatureSent] = useState(false)
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setEmail(user.email || "")
          setFullName(user.user_metadata?.full_name || "")
        }

        const res = await fetch("/api/settings/plan")
        if (res.ok) {
          const data = await res.json()
          setPlan(data.plan)
          setContactCount(data.contactCount)
        }
      } catch {
        // Network error during load — page will show defaults
      }
    }
    loadUser()
  }, [supabase])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      })
      if (error) throw error
      addToast({ title: "Profile updated", description: "Your name has been saved." })
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      addToast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      })
      return
    }
    if (newPassword.length < 6) {
      addToast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      })
      return
    }

    setIsPasswordLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error
      setNewPassword("")
      setConfirmPassword("")
      addToast({ title: "Password updated", description: "Your password has been changed." })
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password",
        variant: "destructive",
      })
    } finally {
      setIsPasswordLoading(false)
    }
  }

  const handleManagePlan = async () => {
    setIsPlanLoading(true)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        router.push("/pricing")
      }
    } catch {
      router.push("/pricing")
    } finally {
      setIsPlanLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return
    setIsDeletingAccount(true)
    try {
      const res = await fetch("/api/settings/delete-account", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to delete account")
      }
      await supabase.auth.signOut()
      router.push("/")
      router.refresh()
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account",
        variant: "destructive",
      })
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteAccountDialog(false)
      setDeleteConfirmText("")
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-normal tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      {/* Account Section */}
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 pt-2">Account</h2>

      {/* Profile */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <User className="h-4 w-4 text-muted-foreground" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={isLoading} variant="outline">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={isPasswordLoading} variant="outline">
              {isPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <Crown className="h-4 w-4 text-muted-foreground" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">
                  {plan === "pro" ? "Pro" : "Free"} Plan
                </span>
                {plan === "pro" && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--copper)] text-white">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {plan === "pro"
                  ? `${contactCount} contacts in your network`
                  : `${contactCount}/50 contacts \u00B7 Upgrade for unlimited`}
              </p>
              {plan === "pro" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Unlimited contacts \u00B7 CSV &amp; Gmail import \u00B7 Calendar sync \u00B7 Daily digest \u00B7 AI drafts &amp; prep
                </p>
              )}
            </div>
            {plan === "pro" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManagePlan}
                disabled={isPlanLoading}
              >
                {isPlanLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Manage Plan
              </Button>
            ) : (
              <Button
                size="sm"
                asChild
                className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
              >
                <Link href="/pricing">Upgrade to Pro</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 pt-2">Preferences</h2>

      {/* Notifications */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationPreferences />
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <Sun className="h-4 w-4 text-muted-foreground" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      {/* Feature Request */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            Want a feature? Let us know
          </CardTitle>
        </CardHeader>
        <CardContent>
          {featureSent ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Thanks for your suggestion!</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">We read every request and will get back to you via email.</p>
                <button
                  type="button"
                  onClick={() => { setFeatureSent(false); setFeatureRequest("") }}
                  className="text-xs text-emerald-600 font-medium mt-2 hover:underline"
                >
                  Submit another idea
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!featureRequest.trim()) return
                setIsFeatureLoading(true)
                try {
                  const res = await fetch("/api/support", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subject: "Feature request", message: featureRequest.trim() }),
                  })
                  if (!res.ok) throw new Error((await res.json()).message)
                  setFeatureSent(true)
                } catch (error) {
                  addToast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to send",
                    variant: "destructive",
                  })
                } finally {
                  setIsFeatureLoading(false)
                }
              }}
              className="space-y-3"
            >
              <Textarea
                value={featureRequest}
                onChange={(e) => setFeatureRequest(e.target.value)}
                placeholder="What would make Savvo better for you?"
                rows={3}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">We read every suggestion</p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isFeatureLoading || featureRequest.trim().length < 5}
                  variant="outline"
                >
                  {isFeatureLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Send
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Support */}
      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Support
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Have a question, found a bug, or need help with your account?
          </p>
          <Button variant="outline" asChild>
            <Link href="/support">
              Contact Support
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Data Section */}
      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 pt-2">Data</h2>

      {/* Recently Deleted */}
      <RecentlyDeleted />

      {/* Danger Zone */}
      <Card className="shadow-refined border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Dialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)]">
              <DialogHeader>
                <DialogTitle>Delete Account</DialogTitle>
                <DialogDescription>
                  This will permanently delete your account and all contacts. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="delete-confirm">
                  Type <strong>DELETE</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="h-11"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteAccountDialog(false)
                    setDeleteConfirmText("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || deleteConfirmText !== "DELETE"}
                >
                  {isDeletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <div className="pt-2 pb-8">
        <Button variant="outline" onClick={handleSignOut} className="text-muted-foreground">
          Sign out
        </Button>
      </div>
    </div>
  )
}
