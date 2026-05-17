import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcon } from '@/features/applications/icons/enrich'
import AppManage from '@/features/applications/manage/app-manage'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUserContext()
  const app = await orchestratorApplicationsClient
    .getApplication(slug)
    .then(item => {
      if (user.role !== 'admin' && item.ownerUserId !== user.ownerUserId) {
        throw new Error('Not found')
      }

      return item
    })
    .then(mapAndroidApplicationToAppDefinition)
    .then(withStoredAppIcon)
    .catch(() => undefined)

  return <AppManage app={app} />
}
