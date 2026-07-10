import { RuntimeGappsImageBuilderPageClient } from './gapps-page-client'
import { loadRuntimeGappsBuilderPageData } from './gapps-page-data.server'

export const RuntimeImageBuilderPageEntry = async ({ uploadedApkId }: { uploadedApkId?: string } = {}) => {
  const data = await loadRuntimeGappsBuilderPageData()

  return (
    <RuntimeGappsImageBuilderPageClient
      {...data}
      uploadedApkId={uploadedApkId}
    />
  )
}
