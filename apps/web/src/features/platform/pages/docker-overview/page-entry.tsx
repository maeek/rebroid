import { Suspense } from 'react'
import { InfrastructureServicePage } from '@/features/platform/services/infrastructure-service-page'
import { DockerOverviewLoading } from '@/features/platform/services/infrastructure-service-skeleton'
import { loadDockerOverviewPageData } from './page-data.server'

const DockerOverviewContent = async () => {
  const data = await loadDockerOverviewPageData()

  return (
    <InfrastructureServicePage
      serviceId='docker'
      {...data}
    />
  )
}

export const DockerOverviewPageEntry = () => (
  <Suspense fallback={<DockerOverviewLoading />}>
    <DockerOverviewContent />
  </Suspense>
)
