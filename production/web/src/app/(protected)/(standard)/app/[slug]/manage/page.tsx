import { withStoredAppIcon } from '@/lib/app-icons/enrich'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import AppManage from './app-manage'

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
