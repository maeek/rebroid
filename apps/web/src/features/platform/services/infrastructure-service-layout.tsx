import type { ReactNode } from 'react'
import { Section } from '@/components/ui/section'
import { DetailFields } from '@/shared/ui/detail-fields'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ResourceLink } from '@/shared/ui/resource-link'

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
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Platform', href: '/platform' }}
      trail={[{ label: 'Services', href: '/platform/services' }]}
      title={serviceId === 'docker' ? 'Docker' : 'Orchestrator'}
      actions={actions}
    />
    <PageContent>
      {health}
      {serviceId === 'docker' ? (
        <>
          {limits}
          <Section
            surface='plain'
            title='Infrastructure diagnostics'
            description='Live Docker transport metrics, queues, retries, and recent failures.'
          >
            {diagnostics}
          </Section>
        </>
      ) : (
        <Section
          surface='panel'
          title='Details'
        >
          <DetailFields
            loading={loading}
            fields={[
              { label: 'API URL', value: apiUrl, code: true, copyValue: apiUrl },
              { label: 'Connection management', value: 'Managed by deployment configuration' }
            ]}
          />
          <div className='flex flex-wrap gap-4'>
            <ResourceLink href='/platform/services?service=docker'>Docker diagnostics and limits</ResourceLink>
            <ResourceLink href='/platform/runtime'>Runtime defaults</ResourceLink>
          </div>
        </Section>
      )}
    </PageContent>
  </StandardPage>
)
