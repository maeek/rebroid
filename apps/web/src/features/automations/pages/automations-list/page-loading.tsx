import { getCurrentUser } from '@/server/auth/authorization'
import { AutomationsListPageSkeleton } from '../../automations-page/automation-page-skeletons'

export async function AutomationsListPageLoading() {
  const user = await getCurrentUser()
  return <AutomationsListPageSkeleton canManageHistoryRetention={user.isPlatformAdmin} />
}
