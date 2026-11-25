import { Suspense } from 'react'
import { DockerOverviewPageClient } from './page-client'
import { loadDockerOverviewPageData } from './page-data.server'
import { DockerOverviewLoading } from './page-loading'

const DockerOverviewContent = async () => {
  const data = await loadDockerOverviewPageData()

  return <DockerOverviewPageClient {...data} />
}

export const DockerOverviewPageEntry = () => (
  <Suspense fallback={<DockerOverviewLoading />}>
    <DockerOverviewContent />
  </Suspense>
)
