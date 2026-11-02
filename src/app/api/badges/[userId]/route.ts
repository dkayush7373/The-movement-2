import { NextRequest } from "next/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { apiSuccess, apiError } from "@/lib/api-response"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = getAdminClient()
    const rawUserId = params.userId

    if (!rawUserId) {
      return apiError("User ID parameter is required", 400)
    }

    const clean = rawUserId.replace(/^@/, "").trim()
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let resolvedId = clean

    if (!UUID_REGEX.test(clean)) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .ilike("username", clean)
        .maybeSingle()

      if (profile) {
        resolvedId = profile.id
      } else {
        return apiSuccess([])
      }
    }

    const { data: badges, error } = await admin
      .from("badges")
      .select("*")
      .eq("user_id", resolvedId)
      .order("awarded_at", { ascending: false })

    if (error) {
      return apiError("Failed to fetch user badges", 500)
    }

    return apiSuccess(badges || [])
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    return apiError(msg, 500)
  }
}

