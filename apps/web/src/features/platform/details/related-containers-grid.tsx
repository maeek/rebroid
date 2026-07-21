'use client'

import { useMemo, useState } from 'react'
import { IconEye } from '@tabler/icons-react'
import Link from 'next/link'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { ContainerStateBadge } from '@/features/platform/components/runtime-containers-table-parts'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import type { PlatformContainer } from '@/shared/contracts/platform'
import type { ColumnDef } from '@tanstack/react-table'

export const RelatedContainersGrid = ({
  containers,
  relation
}: {
  containers: PlatformContainer[]
  relation: 'application' | 'image'
}) => {
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const visibleContainers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return containers.filter(container => {
      if (
        query &&
        !`${container.names.join(' ')} ${container.id} ${container.image} ${container.applicationId ?? ''}`
          .toLowerCase()
          .includes(query)
      )
        return false
      return true
    })
  }, [containers, search])
  const columns = useMemo<ColumnDef<PlatformContainer>[]>(
    () => [
      {
        id: 'name',
        accessorFn: container => container.names[0] ?? container.shortId,
        header: 'Container',
        size: 320,
        meta: { label: 'Container', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <div className='grid gap-1'>
            <Link
              className='truncate font-medium hover:text-primary'
              href={`/runtime/containers/${row.original.id}`}
            >
              {row.original.names[0] ?? row.original.shortId}
            </Link>
            <span className='truncate font-mono text-xs text-foreground-muted'>{row.original.shortId}</span>
          </div>
        )
      },
      {
        id: 'state',
        accessorFn: container => container.state,
        header: 'State',
        size: 128,
        meta: { label: 'State', skeleton: { kind: 'badge' } },
        cell: ({ row }) => <ContainerStateBadge state={row.original.state} />
      },
      {
        id: 'relation',
        accessorFn: container =>
          relation === 'application' ? (container.applicationId ?? 'unmanaged') : container.image,
        header: relation === 'application' ? 'Application' : 'Image',
        size: 320,
        meta: { label: relation === 'application' ? 'Application' : 'Image', skeleton: { kind: 'text' } },
        cell: ({ row }) => (
          <span className='text-sm text-foreground-muted'>
            {relation === 'application' ? (row.original.applicationId ?? 'unmanaged') : row.original.image}
          </span>
        )
      }
    ],
    [relation]
  )

  return (
    <DataGridWorkspace
      search={searchDraft}
      searchPlaceholder='Search related containers'
      onSearchChange={setSearchDraft}
      onSearch={setSearch}
    >
      <DataGrid
        columns={columns}
        data={visibleContainers}
        totalItems={visibleContainers.length}
        pageIndex={0}
        pageSize={Math.max(visibleContainers.length, 1)}
        getRowId={container => container.id}
        minWidth='48rem'
        emptyState={<div className='text-center text-foreground-muted'>No related containers match this search.</div>}
        rowContextMenu={row => (
          <ContextMenuItem asChild>
            <Link href={`/runtime/containers/${row.original.id}`}>
              <IconEye className='mr-2 size-4' />
              Details
            </Link>
          </ContextMenuItem>
        )}
      />
    </DataGridWorkspace>
  )
}
