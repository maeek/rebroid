'use client'

import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { PlatformResources } from '@/shared/ui/platform/platform-resources'
import { StateView } from '@/shared/ui/state-view'
import { DetailsTable } from './details-table'
import { ManagedContainerDetailsTable } from './managed-container-details-table'
import { SystemResourceCharts } from './system-resource-charts'
import type { SystemResources } from '@/shared/contracts/system-resources'
import type { SystemStats } from '@/shared/contracts/system-stats'

export const SystemResourcesContent = ({
  systemUtilization,
  resources,
  resourcesError = false,
  isRefreshingResources = false,
  refreshResources = () => Promise.resolve(),
  loading = false
}: {
  systemUtilization?: SystemStats
  resources?: SystemResources
  resourcesError?: boolean
  isRefreshingResources?: boolean
  refreshResources?: () => Promise<void>
  loading?: boolean
}) => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'System' }}
      title='Resources'
    />
    <PageContent>
      <div className='grid gap-6 xl:grid-cols-2'>
        <Section
          title='Host system'
          surface='panel'
          headingSpacing='default'
          contentClassName='gap-3'
          className='h-full'
        >
          <p className='text-sm text-foreground-muted'>
            Operating-system level CPU and memory stats for the machine running the orchestrator.
          </p>
          <DetailsTable
            systemUtilization={systemUtilization}
            loading={loading}
          />
        </Section>
        <Section
          title='Managed containers'
          surface='panel'
          headingSpacing='default'
          contentClassName='gap-3'
          className='h-full'
        >
          <p className='text-sm text-foreground-muted'>
            Live aggregated Docker stats across managed app containers, shown separately from host-level usage.
          </p>
          <Visible when={resourcesError}>
            <StateView
              kind='unavailable'
              scope='grid'
              title='Orchestrator resources unavailable'
              description='Docker inventory could not be loaded from the orchestrator.'
              actions={[{ label: 'Refresh', onClick: () => void refreshResources() }]}
              className='min-h-64 p-4'
            />
          </Visible>
          <Visible when={!resourcesError}>
            <ManagedContainerDetailsTable
              resources={resources}
              loading={loading || !resources}
            />
          </Visible>
        </Section>
      </div>
      <Visible when={!resourcesError}>
        <PlatformResources
          loading={loading || !resources}
          resources={resources}
          isRefreshing={isRefreshingResources}
          onRefresh={refreshResources}
        />
      </Visible>
      <SystemResourceCharts
        stats={systemUtilization}
        loading={loading}
      />
    </PageContent>
  </StandardPage>
)
