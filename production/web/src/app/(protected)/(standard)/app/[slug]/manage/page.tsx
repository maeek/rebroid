import { withStoredAppIcon } from '@/lib/app-icons/enrich'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { orchestratorApi } from '@/lib/orchestrator/client'
import AppManage from './app-manage'

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const app = await orchestratorApi
    .getApplication(slug)
    .then(mapAndroidApplicationToAppDefinition)
    .then(withStoredAppIcon)
    .catch(() => undefined)

  return <AppManage app={app} />
}
