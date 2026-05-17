'use client'

import {
  ContainerActions,
  ContainerNameCell,
  ContainerStateBadge
} from '@/app/(protected)/(standard)/settings/orchestrator/_components/orchestrator-containers-table-parts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PlatformContainer } from '@/server/orchestrator/platform/types'

export const OrchestratorContainersTable = ({
  containers,
  isLoading,
  busyId,
  emptyMessage = 'No containers are visible to Docker.',
  onStop,
  onRemove
}: {
  containers: PlatformContainer[]
  isLoading: boolean
  busyId: string | null
  emptyMessage?: string
  onStop: (container: PlatformContainer) => void
  onRemove: (container: PlatformContainer) => void
}) => {
  const colSpan = 6

  return (
    <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
      <div className='overflow-x-auto'>
        <TooltipProvider delayDuration={150}>
          <Table
            className='table-fixed'
            style={{ minWidth: '90rem' }}
          >
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-[18rem] px-4 py-3 uppercase'>Container</TableHead>
                <TableHead className='w-32 px-4 py-3 uppercase'>State</TableHead>
                <TableHead className='w-[24rem] px-4 py-3 uppercase'>Image</TableHead>
                <TableHead className='w-[16rem] px-4 py-3 uppercase'>Application</TableHead>
                <TableHead className='w-[18rem] px-4 py-3 uppercase'>Networks</TableHead>
                <TableHead className='w-[16rem] px-4 py-3 text-right uppercase'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && containers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className='px-4 py-4 text-sm text-secondary-foreground'
                  >
                    Loading containers...
                  </TableCell>
                </TableRow>
              ) : containers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className='px-4 py-4 text-sm text-secondary-foreground'
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                containers.map(container => (
                  <TableRow key={container.id}>
                    <TableCell className='px-4 py-3 align-top'>
                      <ContainerNameCell container={container} />
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <ContainerStateBadge state={container.state} />
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='truncate text-sm text-secondary-foreground'>{container.image}</div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='truncate text-sm text-secondary-foreground'>
                        {container.applicationId ?? 'unmanaged'}
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='truncate text-sm text-secondary-foreground'>
                        {container.networks.length > 0 ? container.networks.join(', ') : 'none'}
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <ContainerActions
                        container={container}
                        busyId={busyId}
                        onStop={onStop}
                        onRemove={onRemove}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
    </div>
  )
}
