import { NextResponse } from 'next/server'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'

export const dynamic = 'force-dynamic'

export const GET = async () => {
  const user = await getCurrentUserContext()
  const [apps, ownerNames] = await Promise.all([listApplicationsAction(), getVisibleOwnerDisplayNames(user)])
  return NextResponse.json(
    apps.map(app => ({
      ...app,
      ownerDisplayName: user.isPlatformAdmin ? getOwnerDisplayName(ownerNames, app.ownerUserId) : null
    }))
  )
}
