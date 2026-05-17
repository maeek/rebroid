import { AppViewerPage } from '@/features/applications/detail/app-page'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcon } from '@/features/applications/icons/enrich'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
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

  return <AppViewerPage app={app} />
}
