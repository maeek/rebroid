'use client'

import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import {
  ContainerActions,
  ContainerNameCell,
  ContainerStateBadge
} from '@/features/orchestrator/components/orchestrator-containers-table-parts'
import type { PlatformContainer } from '@/server/orchestrator/platform/types'

export const OrchestratorContainersTable = ({
  containers,
  isLoading,
  busyId,
  emptyMessage = 'No containers are visible to Docker.',
  onStop,
  onRemove,
  selectedIds,
  onSelect,
  onSelectPage
}: {
  containers: PlatformContainer[]
  isLoading: boolean
  busyId: string | null
  emptyMessage?: string
  onStop: (container: PlatformContainer) => void
  onRemove: (container: PlatformContainer) => void
  selectedIds: Set<string>
  onSelect: (container: PlatformContainer, index: number, shiftKey: boolean) => void
  onSelectPage: (selected: boolean) => void
}) => {
  const colSpan = 7
  const allPageSelected = containers.length > 0 && containers.every(container => selectedIds.has(container.id))

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
                <TableHead className='w-12 px-4 py-3'>
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={checked => onSelectPage(checked === true)}
                  />
                </TableHead>
                <TableHead className='w-[18rem] px-4 py-3 uppercase'>Container</TableHead>
                <TableHead className='w-32 px-4 py-3 uppercase'>State</TableHead>
                <TableHead className='w-[24rem] px-4 py-3 uppercase'>Image</TableHead>
                <TableHead className='w-[16rem] px-4 py-3 uppercase'>Application</TableHead>
                <TableHead className='w-[18rem] px-4 py-3 uppercase'>Networks</TableHead>
                <TableHead className='w-[16rem] px-4 py-3 text-right uppercase'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Visible when={isLoading && containers.length === 0}>
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className='px-4 py-4 text-sm text-secondary-foreground'
                  >
                    Loading containers...
                  </TableCell>
                </TableRow>
              </Visible>
              <Visible when={!isLoading && containers.length === 0}>
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className='px-4 py-4 text-sm text-secondary-foreground'
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              </Visible>
              <Visible when={containers.length > 0}>
                {containers.map((container, index) => (
                  <TableRow key={container.id}>
                    <TableCell className='px-4 py-3'>
                      <Checkbox
                        checked={selectedIds.has(container.id)}
                        onClick={event => onSelect(container, index, event.shiftKey)}
                        onCheckedChange={() => undefined}
                      />
                    </TableCell>
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
                      <div className='flex flex-wrap gap-1 text-sm text-secondary-foreground'>
                        {container.networks.length > 0
                          ? container.networks.map(network => (
                              <Link
                                key={network}
                                href={`/settings/orchestrator/networks/${encodeURIComponent(network)}`}
                                className='max-w-full truncate rounded-full bg-background/60 px-2 py-0.5 hover:text-primary'
                              >
                                {network}
                              </Link>
                            ))
                          : 'none'}
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
                ))}
              </Visible>
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
    </div>
  )
}
