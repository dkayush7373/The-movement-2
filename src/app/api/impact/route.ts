import { NextRequest } from "next/server"
import { getAdminClient, getCallerUser } from "@/lib/supabase/admin"
import { apiSuccess, apiError } from "@/lib/api-response"
import { ImpactLedgerEntry } from "@/lib/schemas/impact-ledger.schema"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function GET(req: NextRequest) {
  try {
    const admin = getAdminClient()
    const { searchParams } = new URL(req.url)
    const caller = await getCallerUser(req)
    const userId = searchParams.get("userId") || caller?.id
    const movementId =
      searchParams.get("movementId") ||
      searchParams.get("movement_id") ||
      "00000000-0000-4000-8000-000000000001"

    if (userId) {
      const clean = userId.replace(/^@/, "").trim()
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let resolvedId = clean
      let userRecord: Record<string, unknown> | null = null

      if (UUID_REGEX.test(clean)) {
        const { data: u } = await admin.from("users").select("*").eq("id", clean).maybeSingle()
        if (u) {
          userRecord = u
        } else {
          const { data: p } = await admin.from("profiles").select("*").eq("id", clean).maybeSingle()
          if (p) userRecord = p
        }
      } else {
        const { data: p } = await admin.from("profiles").select("*").ilike("username", clean).maybeSingle()
        if (p) {
          resolvedId = p.id
          const { data: u } = await admin.from("users").select("*").eq("id", p.id).maybeSingle()
          userRecord = u || p
        }
      }

      if (!userRecord) {
        const { FICTIONAL_USERS } = await import("@/lib/mocks/fictional-data")
        const match = FICTIONAL_USERS.find(
          (u) =>
            u.id === clean ||
            u.handle.toLowerCase() === clean.toLowerCase() ||
            (clean.toLowerCase() === "janardhan" && u.id === "11111111-1111-4111-8111-111111111111")
        )
        if (match) {
          const { SEED_IMPACT_ENTRIES } = await import("@/lib/mocks/seed-data")
          const userEntries = SEED_IMPACT_ENTRIES.filter((e) => e.user_id === match.id)
          return apiSuccess({
            user: match,
            stats: {
              tasks_completed: match.stats.tasksCompleted,
              badges_earned: match.earnedBadgeIds.length,
              check_ins_count: 5,
              total_impact_points: match.stats.impactScore,
            },
            badges: [],
            ledger: userEntries,
          })
        }
        return apiError("User profile not found", 404)
      }

      const user = userRecord

      // 2. Fetch user's verified task claims
      const { data: verifiedClaims } = await admin
        .from("task_claims")
        .select("*, task:tasks(*)")
        .eq("claimed_by", resolvedId)
        .eq("status", "verified")
        .order("verified_at", { ascending: false })

      // 3. Fetch user badges
      const { data: badges } = await admin
        .from("badges")
        .select("*")
        .eq("user_id", resolvedId)
        .order("awarded_at", { ascending: false })

      // 4. Fetch user check-ins count
      const { count: checkInsCount } = await admin
        .from("check_ins")
        .select("*", { count: "exact", head: true })
        .eq("user_id", resolvedId)

      // 5. Build Impact Ledger Entries
      const ledger: ImpactLedgerEntry[] = (verifiedClaims || []).map((claim) => {
        const matchingBadge = (badges || []).find((b) => b.claim_id === claim.id)
        const isPeerVote = matchingBadge?.issued_by !== "organizer_override"
        const rewardPoints = claim.task?.reward_points || 50
        const taskTitle = claim.task?.title || "Community Bounty Task"

        return {
          id: claim.id,
          user_id: userId,
          task_id: claim.task_id,
          task_title: taskTitle,
          verification_method: isPeerVote ? "peer_vote" : "organizer_override",
          verified_by_detail: isPeerVote
            ? "Peer Review Consensus (2/3)"
            : "Verified by Organizer",
          reward_points: rewardPoints,
          verified_at: claim.verified_at || claim.completed_at || claim.claimed_at,
        }
      })

      // Calculate total points
      const totalPoints = ledger.reduce((sum, item) => sum + item.reward_points, 0)

      return apiSuccess({
        user,
        stats: {
          tasks_completed: ledger.length,
          badges_earned: badges?.length || 0,
          check_ins_count: checkInsCount || 0,
          total_impact_points: totalPoints,
        },
        badges: badges || [],
        ledger,
      })
    }

    // Global / Movement-wide Impact Summary
    const { count: totalTasksCompleted } = await admin
      .from("task_claims")
      .select("*", { count: "exact", head: true })
      .eq("status", "verified")

    const { count: totalBadgesAwarded } = await admin
      .from("badges")
      .select("*", { count: "exact", head: true })

    const { count: totalCheckIns } = await admin
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("movement_id", movementId)

    const { count: totalVolunteers } = await admin
      .from("movement_members")
      .select("*", { count: "exact", head: true })
      .eq("movement_id", movementId)

    return apiSuccess({
      movement_id: movementId,
      stats: {
        total_volunteers: totalVolunteers || 0,
        tasks_completed: totalTasksCompleted || 0,
        badges_awarded: totalBadgesAwarded || 0,
        total_check_ins: totalCheckIns || 0,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    return apiError(msg, 500)
  }
}

