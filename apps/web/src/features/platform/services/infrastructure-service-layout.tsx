import type { ComponentProps, ReactNode } from 'react'
import { Section } from '@/components/ui/section'
import { DetailFields } from '@/shared/ui/detail-fields'
import { ServiceConnectionLinks } from '@/shared/ui/platform/service-connection-links'
import { serviceContainerField } from '@/shared/ui/platform/service-container-field'
import { ServiceDetailLayout } from '@/shared/ui/platform/service-detail-layout'
import type { ServiceContainer } from '@/shared/contracts/diagnostics'

const orchestratorRelatedLinks = [
  { href: '/runtime/docker', label: 'Docker diagnostics and limits' },
  { href: '/platform/runtime', label: 'General' }
]

export const InfrastructureServiceLayout = ({
  serviceId,
  actions,
  health,
  healthNotice,
  limits,
  diagnostics,
  apiUrl,
  container,
  loading = false
}: {
  serviceId: 'orchestrator' | 'docker'
  actions: ReactNode
  health?: ComponentProps<typeof ServiceDetailLayout>['health']
  healthNotice?: ComponentProps<typeof ServiceDetailLayout>['healthNotice']
  limits?: ReactNode
  diagnostics?: ReactNode
  apiUrl?: string
  container?: ServiceContainer
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
        contentClassName='gap-6'
      >
        <DetailFields
          loading={loading}
          fields={[
            { label: 'API URL', value: apiUrl, code: true, copyValue: apiUrl, fullWidth: !container },
            ...(container ? [serviceContainerField(container)] : [])
          ]}
        />
        <ServiceConnectionLinks
          containerId={loading ? undefined : container?.id}
          showContainerLink={false}
          relatedLinks={orchestratorRelatedLinks}
        />
      </Section>
    )}
  </ServiceDetailLayout>
)
