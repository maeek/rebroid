'use client'

import { Section } from '@/components/ui/section'
import { ContainerActionDialog } from '@/features/platform/details/runtime-container-detail/container-action-dialog'
import {
  ContainerDetailProvider,
  useContainerDetailContext
} from '@/features/platform/details/runtime-container-detail/container-detail-context'
import { ContainerLogsSection } from '@/features/platform/details/runtime-container-detail/container-logs-section'
import { ContainerOverviewSection } from '@/features/platform/details/runtime-container-detail/container-overview-section'
import { LiveResourcesSection } from '@/features/platform/details/runtime-container-detail/live-resources-section'
import {
  RelatedImageSection,
  RelatedNetworksSection
} from '@/features/platform/details/runtime-container-detail/related-container-sections'
import { PageContent } from '@/shared/ui/page/page-layout'
import { PlatformJsonBlock } from '@/shared/ui/platform/platform-detail-parts'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/shared/contracts/platform'

export const RuntimeContainerDetail = ({
  details,
  initialLogs
}: {
  details: PlatformContainerDetails
  initialLogs: PlatformContainerLog
}) => {
  return (
    <ContainerDetailProvider
      details={details}
      initialLogs={initialLogs}
    >
      <RuntimeContainerDetailContent />
    </ContainerDetailProvider>
  )
}

const RuntimeContainerDetailContent = () => {
  const { details } = useContainerDetailContext()
  const container = details.container

  return (
    <>
      <PageContent>
        <ContainerOverviewSection />

        <LiveResourcesSection />

        <div className='grid gap-6 xl:grid-cols-2'>
          <RelatedImageSection />
          <RelatedNetworksSection />
        </div>

        <ContainerLogsSection />

        <Section
          title='Labels'
          surface='plain'
          contentClassName='gap-4'
          headingSpacing='default'
        >
          <PlatformJsonBlock value={container.labels} />
        </Section>

        <Section
          title='Raw inspect'
          surface='plain'
          collapsible
          contentClassName='gap-4'
        >
          <PlatformJsonBlock value={details.inspect} />
        </Section>
      </PageContent>

      <ContainerActionDialog />
    </>
  )
}
