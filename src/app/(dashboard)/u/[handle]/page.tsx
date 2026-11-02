import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/PageHeader"
import { ProfileView } from "@/components/profile/ProfileView"
import { getUserByHandle } from "@/lib/mocks/fictional-data"

export async function generateMetadata({
  params,
}: {
  params: { handle: string }
}): Promise<Metadata> {
  const user = getUserByHandle(params.handle)
  const name = user ? user.display_name : `@${params.handle}`
  return {
    title: `${name} | The Movement`,
    description: `Public verification ledger, earned badges, and community action record for volunteer ${name}.`,
  }
}

export default function HandleProfilePage({
  params,
}: {
  params: { handle: string }
}) {
  const user = getUserByHandle(params.handle)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volunteer Profile"
        description="Public verification ledger, earned badges, and community recognition record."
      />
      <ProfileView userId={user ? user.id : params.handle} />
    </div>
  )
}
