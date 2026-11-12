import type { ComponentProps, ReactNode } from 'react'
import { Section } from '@/components/ui/section'
import { DetailFields } from '@/shared/ui/detail-fields'
import { DockerContainerLinks } from '@/shared/ui/platform/docker-container-links'
import { ServiceDetailLayout } from '@/shared/ui/platform/service-detail-layout'
import { ResourceLink } from '@/shared/ui/resource-link'

export const InfrastructureServiceLayout = ({
  serviceId,
  actions,
  health,
  healthNotice,
  limits,
  diagnostics,
  apiUrl,
  containerId,
  loading = false
}: {
  serviceId: 'orchestrator' | 'docker'
  actions: ReactNode
  health?: ComponentProps<typeof ServiceDetailLayout>['health']
  healthNotice?: ComponentProps<typeof ServiceDetailLayout>['healthNotice']
  limits?: ReactNode
  diagnostics?: ReactNode
  apiUrl?: string
  containerId?: string
  loading?: boolean
}) => (
  <ServiceDetailLayout
    title={serviceId === 'docker' ? 'Docker' : 'Orchestrator'}
    navigation={serviceId === 'docker' ? { section: { label: 'Docker' }, breadcrumbLabel: 'Overview' } : undefined}
    refresh={actions}
    health={health}
    healthNotice={healthNotice}
    loading={loading}
  >
    {serviceId === 'docker' ? (
      <>
        {limits}
        {diagnostics ? (
          <Section
            surface='plain'
            title='Infrastructure diagnostics'
            description='Live Docker transport metrics, queues, retries, and recent failures.'
          >
            {diagnostics}
          </Section>
        ) : null}
      </>
    ) : (
      <Section
        surface='panel'
        title='Connection'
        description='Managed by your deployment configuration.'
        actions={
          !loading && containerId ? (
            <DockerContainerLinks
              containerId={containerId}
              className='max-sm:flex-col max-sm:items-end'
            />
          ) : undefined
        }
        contentClassName='gap-6'
      >
        <DetailFields
          loading={loading}
          fields={[{ label: 'API URL', value: apiUrl, code: true, copyValue: apiUrl, fullWidth: true }]}
        />
        <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm'>
          <ResourceLink href='/runtime/docker'>Docker diagnostics and limits</ResourceLink>
          <ResourceLink href='/platform/runtime'>General</ResourceLink>
        </div>
      </Section>
    )}
  </ServiceDetailLayout>
)
