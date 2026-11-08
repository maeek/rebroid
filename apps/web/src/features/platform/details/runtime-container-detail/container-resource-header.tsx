'use client'

import type { ReactNode } from 'react'
import { IconPlayerStopFilled, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ContainerStateBadge } from '@/features/platform/components/runtime-containers-table-parts'
import { PageHeader } from '@/shared/ui/page/page-header'
import { useContainerDetailContext, useContainerDetailControllerContext } from './container-detail-context'
import type { PlatformContainerDetails } from '@/shared/contracts/platform'

const ContainerActions = ({
  container,
  onAction
}: {
  container?: PlatformContainerDetails['container']
  onAction?: (action: 'stop' | 'remove') => void
}) => {
  return (
    <div className='flex flex-wrap gap-2'>
      <Button
        type='button'
        variant='secondary'
        disabled={!onAction || container?.state !== 'running'}
        onClick={() => onAction?.('stop')}
      >
        <IconPlayerStopFilled className='size-4' />
        Stop
      </Button>
      <Button
        type='button'
        variant='danger'
        disabled={!onAction}
        onClick={() => onAction?.('remove')}
      >
        <IconTrash className='size-4' />
        Remove
      </Button>
    </div>
  )
}

export const ContainerResourceHeader = () => {
  const {
    details: { container }
  } = useContainerDetailContext()
  const { setPendingAction } = useContainerDetailControllerContext()
  return (
    <ContainerResourceHeading
      container={container}
      actions={
        <ContainerActions
          container={container}
          onAction={setPendingAction}
        />
      }
    />
  )
}

export const ContainerResourceHeading = ({
  container,
  actions
}: {
  container?: PlatformContainerDetails['container']
  actions?: ReactNode
}) => {
  return (
    <PageHeader
      section={{ label: 'Runtime' }}
      breadcrumbLabel={container ? undefined : 'Container'}
      trail={[{ label: 'Containers', href: '/runtime/containers' }]}
      title={container?.names[0] ?? container?.shortId ?? <Skeleton className='h-9 w-64 max-w-full max-sm:h-7' />}
      badges={
        <>
          {!container ? <Skeleton className='h-5 w-24' /> : null}
          {container?.managed ? <Badge variant='success'>managed</Badge> : null}
          {container ? <ContainerStateBadge state={container.state} /> : null}
        </>
      }
      meta={<span className='font-mono'>{container?.shortId ?? <Skeleton className='h-4 w-24' />}</span>}
      actions={actions ?? <ContainerActions />}
    />
  )
}
