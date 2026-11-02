"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { ProfileSkeleton } from "./ProfileSkeleton"
import { ProfileNotFound } from "./ProfileNotFound"
import { ProfileHeader } from "./ProfileHeader"
import { ProfileStats } from "./ProfileStats"
import { ProfileSettingsCard } from "./ProfileSettingsCard"
import { BadgeGallery } from "./BadgeGallery"
import { ImpactLedger } from "./ImpactLedger"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/providers/AuthProvider"
import { getStoredProfileSettings } from "@/lib/ui-prefs"
import { AlertCircle, RotateCcw, Lock } from "lucide-react"

export interface ProfileViewProps {
  userId: string
}

/**
 * Note: This client component uses TanStack Query because the mock store operates
 * in-memory in the client browser during the prototype/demo phase.
 * When the real Supabase adapter and database are integrated, this data fetching
 * section can cleanly switch to React Server Components (RSC) on the server.
 * Stale seed data is never rendered on the server.
 */
export function ProfileView({ userId }: ProfileViewProps) {
  const { user: authUser } = useAuth()

  const profileQuery = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => api.getUserProfile(userId),
    retry: 1,
  })

  const targetUserId = profileQuery.data?.id || userId

  const badgesQuery = useQuery({
    queryKey: ["userBadges", targetUserId],
    queryFn: () => api.getUserBadges(targetUserId),
    enabled: !!profileQuery.data,
  })

  const ledgerQuery = useQuery({
    queryKey: ["impactLedger", targetUserId],
    queryFn: () => api.getImpactLedger(targetUserId),
    enabled: !!profileQuery.data,
  })

  const statsQuery = useQuery({
    queryKey: ["userStats", targetUserId],
    queryFn: () => api.getUserStats(targetUserId),
    enabled: !!profileQuery.data,
  })

  const isLoading =
    profileQuery.isLoading ||
    (profileQuery.isSuccess && (badgesQuery.isLoading || ledgerQuery.isLoading || statsQuery.isLoading))

  // Loading Skeleton State (avatar plus 4 badge circles)
  if (isLoading) {
    return <ProfileSkeleton />
  }

  // Not Found or Error State
  if (profileQuery.isError) {
    const errorMsg = profileQuery.error instanceof Error ? profileQuery.error.message : ""
    const isNotFound =
      errorMsg.toLowerCase().includes("not found") ||
      errorMsg.toLowerCase().includes("invalid") ||
      errorMsg.toLowerCase().includes("cannot find")

    if (isNotFound) {
      return <ProfileNotFound userId={userId} />
    }

    return (
      <div
        role="alert"
        aria-label="Error loading volunteer profile"
        className="p-6 rounded-md border border-destructive/40 bg-destructive/10 text-center space-y-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/20 text-destructive mx-auto">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-destructive">
          We could not load this profile
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          We could not load this. Check your connection and try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            profileQuery.refetch()
            badgesQuery.refetch()
            ledgerQuery.refetch()
            statsQuery.refetch()
          }}
          className="min-h-[44px] gap-2 border-border"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Try again</span>
        </Button>
      </div>
    )
  }

  const user = profileQuery.data
  if (!user) {
    return <ProfileNotFound userId={userId} />
  }

  const isCurrentUser = Boolean(authUser && user && authUser.id === user.id)
  const settings = getStoredProfileSettings(user.id)

  // If set to members only and viewer is not logged in
  if (settings.visibility === "members" && !authUser) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-chunky border-2 border-ink bg-white shadow-hard-xs space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full bg-sun/30 border-2 border-ink flex items-center justify-center mx-auto text-ink">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-black text-ink font-sans">
          Members-only profile
        </h3>
        <p className="text-xs text-ink/70 leading-relaxed">
          Only movement members can open this link. Please sign in to verify membership and access this profile.
        </p>
        <div className="pt-2">
          <a
            href="/sign-in"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-lime text-ink border-2 border-ink text-xs font-black shadow-hard-xs hover:bg-lime/90"
          >
            <span>Sign in to view</span>
          </a>
        </div>
      </div>
    )
  }

  const badges = badgesQuery.data || []
  const ledger = ledgerQuery.data || []
  const stats = statsQuery.data || {
    tasksCompleted: ledger.length,
    announcementsSigned: 0,
    checkInsCount: 0,
    impactPoints: ledger.reduce((sum, e) => sum + (e.reward_points || 0), 0),
  }

  return (
    <div className="space-y-8">
      {/* 1. Member Header: Avatar, Display Name, Tier Badge, Movement Memberships */}
      <ProfileHeader user={user} isCurrentUser={isCurrentUser} />

      {/* 2. Stats Row: Tasks Completed, Announcements Signed, Check-ins, Impact Points */}
      <ProfileStats stats={stats} />

      {/* 3. Badge Gallery: names visible on hover and keyboard focus */}
      <BadgeGallery badges={badges} user={user} />

      {/* 4. Impact Ledger: task name linking to /tasks, verification method, date, verifier */}
      <ImpactLedger entries={ledger} />

      {/* 5. Privacy & Leaderboard Settings (for profile owner) */}
      <ProfileSettingsCard userId={user.id} isCurrentUser={isCurrentUser} />
    </div>
  )
}
