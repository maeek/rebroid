import { CustomRuntimeImageBuilderPageEntry } from '@/features/platform/pages/runtime-image-builder/custom-page-entry'
import { requireFeature } from '@/server/orchestrator/features'

export default async function CustomRuntimeImageBuildPage() {
  await requireFeature('feature.image-builder')
  return <CustomRuntimeImageBuilderPageEntry />
}
