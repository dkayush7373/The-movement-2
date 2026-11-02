"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TierBadge } from "@/components/shared/TierBadge"
import { UserAvatar } from "@/components/shared/UserAvatar"
import { Monogram } from "@/components/shared/Monogram"
import { SEED_USERS } from "@/lib/mocks/seed-data"
import { UserTier } from "@/lib/schemas/user.schema"
import { ArrowRight, KeyRound, UserCheck } from "lucide-react"
import { logUserSession } from "@/lib/session-logger"

export default function SignInPage() {
  const router = useRouter()
  const { user, signIn } = useAuth()

  // Username login state
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [rememberMe, setRememberMe] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [loginError, setLoginError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("username")
      if (q) setUsername(q)
    }
  }, [])

  const handleSelectUser = async (userId: string) => {
    signIn(userId)
    await logUserSession(userId, "login", { method: "demo_persona" })
    router.push("/feed")
  }

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          remember_me: rememberMe,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid username or password")
      }

      const loggedUser = data.data.user

      const numericTier: 1 | 2 | 3 =
        loggedUser.tier === "organizer" || loggedUser.tier === 3
          ? 3
          : loggedUser.tier === "experienced_volunteer" || loggedUser.tier === 2
          ? 2
          : 1

      const userObj = {
        id: loggedUser.id,
        display_name: loggedUser.display_name || loggedUser.username,
        tier: numericTier,
        handle: loggedUser.username,
        created_at: new Date().toISOString(),
        metadata: {
          username: loggedUser.username,
          email: loggedUser.email,
        },
      }

      // Log session
      await logUserSession(loggedUser.id, "login", {
        username: loggedUser.username,
        method: "username_password",
      })

      // Authenticate in app context
      signIn(loggedUser.id, userObj)
      router.push("/feed")
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      id="main-content"
      className="min-h-screen bg-ivory text-ink flex flex-col items-center justify-center p-4 sm:p-8"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-2">
            <Monogram className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-ink font-sans">
            Sign in to The Movement
          </h1>
          <p className="text-xs text-muted-foreground">
            Decentralized volunteer coordination and consensus verification.
          </p>
        </div>

        {/* Username Login Card */}
        <Card className="border-2 border-ink bg-white shadow-hard-sm">
          <CardHeader className="pb-3 border-b border-ink/10">
            <CardTitle className="text-base font-bold text-ink flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cobalt" />
              <span>Username Sign In</span>
            </CardTitle>
            <CardDescription className="text-xs text-ink/70">
              Log in with your registered volunteer username and password.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleUsernameLogin} className="space-y-3.5">
              {loginError && (
                <div role="alert" className="p-2.5 rounded-sm bg-tomato/10 border border-tomato/30 text-tomato text-xs font-medium">
                  {loginError}
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="login_username" className="text-xs font-bold text-ink">
                  Username
                </label>
                <Input
                  id="login_username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. jana or volunteer"
                  className="h-9 border border-ink/30"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="login_password" className="text-xs font-bold text-ink">
                  Password
                </label>
                <Input
                  id="login_password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 border border-ink/30"
                />
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-ink/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded-xs border-ink bg-white text-cobalt focus:ring-1 focus:ring-ring"
                  />
                  <span>Remember me</span>
                </label>
              </div>

              <Button type="submit" loading={loading} className="w-full min-h-[42px] mt-1 bg-lime text-ink font-bold hover:bg-lime/90 border-2 border-ink shadow-hard-xs">
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Persona Selection Card */}
        <Card className="border-2 border-ink bg-white shadow-hard-sm">
          <CardHeader className="pb-3 border-b border-ink/10">
            <CardTitle className="text-base font-bold text-ink flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-cobalt" />
              <span>Or select a persona</span>
            </CardTitle>
            <CardDescription className="text-xs text-ink/70">
              Each demo role tests different actions across the movement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-4">
            {SEED_USERS.filter((seedUser) => seedUser.id === "11111111-1111-4111-8111-111111111111").map((seedUser) => {
              const isCurrent = user?.id === seedUser.id
              return (
                <button
                  key={seedUser.id}
                  type="button"
                  onClick={() => handleSelectUser(seedUser.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-sm border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isCurrent
                      ? "border-ink bg-cobalt text-white shadow-hard-xs"
                      : "border-ink/20 bg-ivory/50 hover:bg-ivory hover:border-ink text-ink"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar name={seedUser.display_name} avatarUrl={seedUser.avatar_url} className="w-7 h-7 text-xs" />
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isCurrent ? "text-white" : "text-ink"}`}>
                        {seedUser.display_name}
                      </p>
                      <TierBadge
                        tier={seedUser.tier as UserTier}
                        showIcon={false}
                        className="text-xs py-0 px-1 mt-0.5"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                    {isCurrent ? (
                      <span className="bg-lime text-ink px-2 py-0.5 rounded-xs border border-ink">
                        Active
                      </span>
                    ) : (
                      <span className="text-cobalt flex items-center gap-1">
                        <span>Select</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          New volunteer?{" "}
          <Link href="/sign-up" className="text-cobalt hover:underline font-bold">
            Create an account
          </Link>
        </div>

        {user && (
          <div className="text-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/feed")}
              className="text-xs border-2 border-ink bg-white hover:bg-ivory text-ink font-bold shadow-hard-xs"
            >
              Continue to feed as {user.display_name}
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
