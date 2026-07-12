'use client'

import { IconPlayerStopFilled, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { ContainerStateBadge } from '@/features/platform/components/runtime-containers-table-parts'
import {
  useContainerDetailContext,
  useContainerDetailControllerContext
} from '@/features/platform/details/runtime-container-detail/container-detail-context'
import {
  formatContainerNetworks,
  formatContainerPorts
} from '@/features/platform/details/runtime-container-detail/container-detail-utils'
import { DefinitionTable } from '@/shared/ui/definition-table'
import { formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import type { PlatformContainerDetails } from '@/server/orchestrator/platform/types'

const ContainerOverviewHeader = ({ container }: { container: PlatformContainerDetails['container'] }) => {
  const { setPendingAction } = useContainerDetailControllerContext()

  return (
    <div className='flex flex-wrap items-center justify-between gap-4'>
      <div className='flex min-w-0 flex-col gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='text-xl font-medium'>Overview</h3>
          <Visible when={container.managed}>
            <Badge variant='success'>managed</Badge>
          </Visible>
          <ContainerStateBadge state={container.state} />
        </div>
        <div className='max-w-full break-all font-mono text-xs text-foreground-muted'>{container.id}</div>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='secondary'
          disabled={container.state !== 'running'}
          onClick={() => setPendingAction('stop')}
        >
          <IconPlayerStopFilled className='size-4' />
          Stop
        </Button>
        <Button
          type='button'
          variant='danger'
          onClick={() => setPendingAction('remove')}
        >
          <IconTrash className='size-4' />
          Remove
        </Button>
      </div>
    </div>
  )
}

const ContainerIdentityDetails = ({ container }: { container: PlatformContainerDetails['container'] }) => (
  <DefinitionTable
    items={[
      { label: 'Image', value: container.image },
      { label: 'Image ID', value: container.imageId },
      { label: 'Command', value: container.command || 'none' },
      { label: 'Created', value: formatPlatformDate(container.createdAt) },
      { label: 'Status', value: container.status }
    ]}
  />
)

const ContainerRuntimeDetails = ({ container }: { container: PlatformContainerDetails['container'] }) => (
  <DefinitionTable
    items={[
      { label: 'Application', value: container.applicationId ?? 'unmanaged' },
      { label: 'Component', value: container.component ?? 'none' },
      { label: 'Networks', value: formatContainerNetworks(container.networks) },
      { label: 'Ports', value: formatContainerPorts(container.ports) },
      { label: 'Names', value: container.names.join(', ') }
    ]}
  />
)

export const ContainerOverviewSection = () => {
  const { details } = useContainerDetailContext()
  const container = details.container

  return (
    <Section
      surface='plain'
      contentClassName='gap-5'
    >
      <ContainerOverviewHeader container={container} />
      <div className='grid gap-6 xl:grid-cols-2'>
        <ContainerIdentityDetails container={container} />
        <ContainerRuntimeDetails container={container} />
      </div>
    </Section>
  )
}
