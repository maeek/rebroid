'use client'

import { useMemo, useState } from 'react'
import { IconEye } from '@tabler/icons-react'
import Link from 'next/link'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { ContainerStateBadge } from '@/features/platform/components/runtime-containers-table-parts'
import { ApplicationReference } from '@/shared/ui/application-reference'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { PlatformContainer } from '@/shared/contracts/platform'
import type { ColumnDef } from '@tanstack/react-table'

export const RelatedContainersGrid = ({
  containers,
  relation,
  loading = false
}: {
  containers: PlatformContainer[]
  relation: 'application' | 'image'
  loading?: boolean
}) => {
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const visibleContainers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return containers.filter(container => {
      if (
        query &&
        !`${container.names.join(' ')} ${container.id} ${container.image} ${container.applicationId ?? ''} ${container.applicationName ?? ''}`
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
            <ResourceLink
              className='whitespace-normal break-words font-medium'
              href={`/runtime/containers/${encodeURIComponent(row.original.id)}`}
            >
              {row.original.names[0] ?? row.original.shortId}
            </ResourceLink>
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
          relation === 'application'
            ? (container.applicationName ?? container.applicationId ?? 'unmanaged')
            : container.image,
        header: relation === 'application' ? 'Application' : 'Image',
        size: 320,
        meta: {
          label: relation === 'application' ? 'Application' : 'Image',
          skeleton: { kind: relation === 'application' ? 'stacked' : 'text' }
        },
        cell: ({ row }) => {
          const container = row.original
          if (relation === 'application' && container.applicationId) {
            return (
              <ApplicationReference
                id={container.applicationId}
                name={container.applicationName}
              />
            )
          }
          if (relation === 'image' && container.imageId) {
            return (
              <ResourceLink
                href={`/runtime/images/${encodeURIComponent(container.imageId)}`}
                className='whitespace-normal break-words'
              >
                {container.image}
              </ResourceLink>
            )
          }
          return <span className='text-foreground-muted'>{relation === 'image' ? container.image : 'Unmanaged'}</span>
        }
      }
    ],
    [relation]
  )

  return (
    <DataGridWorkspace
      disabled={loading}
      search={searchDraft}
      searchPlaceholder='Search related containers'
      onSearchChange={setSearchDraft}
      onSearch={setSearch}
    >
      <DataGrid
        loading={loading}
        columns={columns}
        data={visibleContainers}
        totalItems={visibleContainers.length}
        pageIndex={0}
        pageSize={Math.max(visibleContainers.length, 1)}
        getRowId={container => container.id}
        minWidth='48rem'
        emptyState={
          <DataGridEmptyState
            title='No related containers'
            description='No containers currently use this resource.'
          />
        }
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
