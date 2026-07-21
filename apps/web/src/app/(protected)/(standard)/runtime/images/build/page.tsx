import { RuntimeImageBuilderPageEntry } from '@/features/platform/pages/runtime-image-builder/page-entry'
import { requireFeature } from '@/server/orchestrator/features'

export default async function RuntimeImageBuildPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireFeature('feature.image-builder')
  const params = (await searchParams) ?? {}
  const apk = Array.isArray(params.apk) ? params.apk[0] : params.apk
  return <RuntimeImageBuilderPageEntry uploadedApkId={apk} />
}
