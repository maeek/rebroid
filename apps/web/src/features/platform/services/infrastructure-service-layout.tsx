import type { ReactNode } from 'react'
import { Section } from '@/components/ui/section'
import { DetailFields } from '@/shared/ui/detail-fields'
import { ResourceLink } from '@/shared/ui/resource-link'
import { ServiceDetailLayout } from './service-detail-layout'

export const InfrastructureServiceLayout = ({
  serviceId,
  actions,
  health,
  limits,
  diagnostics,
  apiUrl,
  loading = false
}: {
  serviceId: 'orchestrator' | 'docker'
  actions: ReactNode
  health: ReactNode
  limits?: ReactNode
  diagnostics?: ReactNode
  apiUrl?: string
  loading?: boolean
}) => (
  <ServiceDetailLayout
    title={serviceId === 'docker' ? 'Docker' : 'Orchestrator'}
    refresh={actions}
  >
    {health}
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
          fields={[{ label: 'API URL', value: apiUrl, code: true, copyValue: apiUrl, fullWidth: true }]}
        />
        <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm'>
          <ResourceLink href='/platform/services?service=docker'>Docker diagnostics and limits</ResourceLink>
          <ResourceLink href='/platform/runtime'>General</ResourceLink>
        </div>
      </Section>
    )}
  </ServiceDetailLayout>
)
