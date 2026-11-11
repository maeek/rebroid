'use client'

import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
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
  systemError = false,
  isRefreshingSystem = false,
  refreshSystem = () => Promise.resolve(),
  isRefreshingResources = false,
  refreshResources = () => Promise.resolve(),
  loading = false
}: {
  systemUtilization?: SystemStats
  resources?: SystemResources
  resourcesError?: boolean
  systemError?: boolean
  isRefreshingSystem?: boolean
  refreshSystem?: () => Promise<void>
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
      {!loading && systemError && resourcesError && !systemUtilization && !resources ? (
        <StateView
          scope='page'
          headingLevel={2}
          kind='unavailable'
          title='Resources unavailable'
          description='Host and container resources could not be loaded. Try again in a moment.'
          actions={[
            {
              label: 'Try again',
              pending: isRefreshingSystem || isRefreshingResources,
              pendingLabel: 'Retrying…',
              onClick: () => {
                void Promise.all([refreshSystem(), refreshResources()])
              }
            },
            { label: 'Go to overview', href: '/platform' }
          ]}
        />
      ) : (
        <>
          <div className='grid gap-6 xl:grid-cols-2'>
            <Section
              title='Host system'
              surface='panel'
              headingSpacing='default'
              contentClassName='gap-3'
              className='h-full'
            >
              <p className='text-sm text-foreground-muted'>
                Operating-system level CPU and memory stats for the machine running the web service.
              </p>
              {systemError ? (
                <Notice
                  tone='warning'
                  title='Host resources unavailable'
                  description={
                    systemUtilization ? 'Showing the last available sample.' : 'Host statistics could not be loaded.'
                  }
                  actions={
                    <MutationButton
                      variant='ghost'
                      pending={isRefreshingSystem}
                      pendingLabel='Retrying…'
                      onClick={() => void refreshSystem()}
                    >
                      Try again
                    </MutationButton>
                  }
                />
              ) : null}
              {loading || systemUtilization ? (
                <DetailsTable
                  systemUtilization={systemUtilization}
                  loading={loading}
                />
              ) : null}
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
              <Visible when={resourcesError && Boolean(resources)}>
                <Notice
                  tone='warning'
                  title='Could not refresh container resources'
                  description='Showing the last available sample. Try again to update it.'
                  actions={
                    <MutationButton
                      variant='ghost'
                      pending={isRefreshingResources}
                      pendingLabel='Retrying…'
                      onClick={() => void refreshResources()}
                    >
                      Try again
                    </MutationButton>
                  }
                />
              </Visible>
              <Visible when={resourcesError && !resources}>
                <StateView
                  kind='unavailable'
                  title='Orchestrator resources unavailable'
                  description='Docker inventory could not be loaded from the orchestrator.'
                  actions={[
                    {
                      label: 'Try again',
                      onClick: () => void refreshResources(),
                      pending: isRefreshingResources,
                      pendingLabel: 'Retrying…'
                    }
                  ]}
                />
              </Visible>
              <Visible when={!resourcesError || Boolean(resources)}>
                <ManagedContainerDetailsTable
                  resources={resources}
                  loading={loading || !resources}
                />
              </Visible>
            </Section>
          </div>
          <Visible when={!resourcesError || Boolean(resources)}>
            <PlatformResources
              loading={loading || !resources}
              resources={resources}
              isRefreshing={isRefreshingResources}
              onRefresh={refreshResources}
            />
          </Visible>
          {loading || systemUtilization ? (
            <SystemResourceCharts
              stats={systemUtilization}
              loading={loading}
            />
          ) : null}
        </>
      )}
    </PageContent>
  </StandardPage>
)
