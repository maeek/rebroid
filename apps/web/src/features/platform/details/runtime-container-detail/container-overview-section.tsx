'use client'

import { useContainerDetailContext } from '@/features/platform/details/runtime-container-detail/container-detail-context'
import { formatContainerPorts } from '@/features/platform/details/runtime-container-detail/container-detail-utils'
import { DetailFields } from '@/shared/ui/detail-fields'
import { OverflowText } from '@/shared/ui/overflow-text'
import { formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import type { PlatformContainerDetails } from '@/shared/contracts/platform'

const ContainerIdentityDetails = ({
  container,
  loading
}: {
  container?: PlatformContainerDetails['container']
  loading?: boolean
}) => (
  <DetailFields
    loading={loading}
    title='Identity'
    fields={[
      { label: 'Name', value: container?.names.join(', '), copyValue: container?.names.join(', '), fullWidth: true },
      { label: 'Created', value: formatPlatformDate(container?.createdAt) },
      { label: 'Status', value: container?.status },
      { label: 'Container ID', value: container?.id, copyValue: container?.id, code: true, fullWidth: true }
    ]}
  />
)

const ContainerRuntimeDetails = ({
  container,
  loading
}: {
  container?: PlatformContainerDetails['container']
  loading?: boolean
}) => {
  const ports = formatContainerPorts(container?.ports ?? [])
  return (
    <DetailFields
      loading={loading}
      title='Configuration'
      fields={[
        { label: 'Component', value: container?.component ?? 'None' },
        {
          label: 'Ports',
          value: <OverflowText value={ports} />,
          copyValue: container?.ports.length ? ports : undefined
        },
        { label: 'Image ID', value: container?.imageId, copyValue: container?.imageId, code: true, fullWidth: true },
        {
          label: 'Command',
          value: container?.command || 'None',
          copyValue: container?.command || undefined,
          code: true,
          fullWidth: true
        }
      ]}
    />
  )
}

export const ContainerOverviewSection = () => {
  const { details } = useContainerDetailContext()
  const container = details.container

  return <ContainerOverviewContent container={container} />
}

export const ContainerOverviewContent = ({
  container,
  loading = false
}: {
  container?: PlatformContainerDetails['container']
  loading?: boolean
}) => {
  return (
    <PlatformResourceSection
      surface='plain'
      title='Overview'
      contentClassName='gap-6'
    >
      <div className='grid min-w-0 gap-8 xl:grid-cols-2'>
        <ContainerIdentityDetails
          container={container}
          loading={loading}
        />
        <ContainerRuntimeDetails
          container={container}
          loading={loading}
        />
      </div>
    </PlatformResourceSection>
  )
}
