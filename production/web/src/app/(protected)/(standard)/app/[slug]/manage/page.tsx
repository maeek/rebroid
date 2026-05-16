import { withStoredAppIcon } from '@/lib/app-icons/enrich'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { orchestratorApi } from '@/lib/orchestrator/client'
import { getCurrentUserContext } from '@/lib/orchestrator/current-owner'
import AppManage from './app-manage'

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getCurrentUserContext()
  const app = await orchestratorApi
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
