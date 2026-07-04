import { RuntimeImageBuilderPageClient } from './page-client'
import { loadRuntimeImageBuilderPageData } from './page-data.server'

export const RuntimeImageBuilderPageEntry = async () => {
  const data = await loadRuntimeImageBuilderPageData()

  return <RuntimeImageBuilderPageClient {...data} />
}
