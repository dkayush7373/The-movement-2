import { NextRequest } from "next/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { apiSuccess, apiError } from "@/lib/api-response"

export const dynamic = "force-dynamic"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  try {
    const admin = getAdminClient()
    const { searchParams } = new URL(req.url)
    const rawUserId = searchParams.get("id") || searchParams.get("userId")

    if (rawUserId) {
      const clean = rawUserId.replace(/^@/, "").trim()
      const isUuid = UUID_REGEX.test(clean)

      if (isUuid) {
        // 1. Look up by UUID in users table
        const { data: user, error } = await admin
          .from("users")
          .select("id, display_name, avatar_url, tier, metadata, created_at, updated_at")
          .eq("id", clean)
          .maybeSingle()

        if (error) return apiError("Failed to fetch user", 500)

        if (user) {
          // Attach handle from profiles if exists
          const { data: profile } = await admin
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .maybeSingle()

          return apiSuccess({
            ...user,
            handle: profile?.username || undefined,
          })
        }

        // 2. Check profiles table by UUID
        const { data: profile } = await admin
          .from("profiles")
          .select("*")
          .eq("id", clean)
          .maybeSingle()

        if (profile) {
          const numericTier: 1 | 2 | 3 =
            profile.tier === "organizer" || profile.tier === 3
              ? 3
              : profile.tier === "experienced_volunteer" || profile.tier === 2
              ? 2
              : 1

          return apiSuccess({
            id: profile.id,
            display_name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.username,
            avatar_url: null,
            tier: numericTier,
            handle: profile.username,
            metadata: profile.metadata || {},
            created_at: profile.created_at || new Date().toISOString(),
            updated_at: profile.updated_at || null,
          })
        }
      } else {
        // 3. Look up by username in profiles table
        const { data: profile } = await admin
          .from("profiles")
          .select("*")
          .ilike("username", clean)
          .maybeSingle()

        if (profile) {
          const { data: user } = await admin
            .from("users")
            .select("id, display_name, avatar_url, tier, metadata, created_at, updated_at")
            .eq("id", profile.id)
            .maybeSingle()

          const numericTier: 1 | 2 | 3 =
            profile.tier === "organizer" || profile.tier === 3
              ? 3
              : profile.tier === "experienced_volunteer" || profile.tier === 2
              ? 2
              : 1

          if (user) {
            return apiSuccess({
              ...user,
              handle: profile.username,
            })
          }

          return apiSuccess({
            id: profile.id,
            display_name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.username,
            avatar_url: null,
            tier: numericTier,
            handle: profile.username,
            metadata: profile.metadata || {},
            created_at: profile.created_at || new Date().toISOString(),
            updated_at: profile.updated_at || null,
          })
        }
      }

      // 4. Fallback to mock / seed data if not found in database (e.g. demo personas)
      const { SEED_USERS } = await import("@/lib/mocks/seed-data")
      const { FICTIONAL_USERS } = await import("@/lib/mocks/fictional-data")
      const seedMatch =
        SEED_USERS.find((u) => u.id === clean || u.handle === clean) ||
        FICTIONAL_USERS.find(
          (u) =>
            u.id === clean ||
            u.handle.toLowerCase() === clean.toLowerCase() ||
            (clean.toLowerCase() === "janardhan" && u.id === "11111111-1111-4111-8111-111111111111")
        )

      if (seedMatch) {
        return apiSuccess({
          id: seedMatch.id,
          display_name: seedMatch.display_name,
          avatar_url: seedMatch.avatar_url,
          tier: seedMatch.tier,
          handle: seedMatch.handle,
          metadata: seedMatch.metadata || {},
          created_at: seedMatch.created_at,
          updated_at: seedMatch.updated_at,
        })
      }

      return apiError("User not found", 404)
    }

    const { data: users, error } = await admin
      .from("users")
      .select("id, display_name, avatar_url, tier, metadata, created_at, updated_at")
      .order("created_at", { ascending: true })

    if (error) return apiError("Failed to fetch users", 500)
    return apiSuccess(users || [])
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    return apiError(msg, 500)
  }
}

