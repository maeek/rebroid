'use client'

import { useMemo, useState } from 'react'
import { IconArrowRight, IconPencil } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { ServiceId } from './service-definitions'
import type { ServiceRow } from './service-row'
import type { ColumnDef } from '@tanstack/react-table'

export const ServicesGrid = ({
  rows,
  loading = false,
  disabled = false,
  onEdit,
  onActivate
}: {
  rows: ServiceRow[]
  loading?: boolean
  disabled?: boolean
  onEdit: (id: ServiceId) => void
  onActivate: (service: ServiceRow) => void
}) => {
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const columns = useMemo<ColumnDef<ServiceRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Service',
        size: 320,
        meta: { label: 'Service', skeleton: { kind: 'stacked' } },
        cell: ({ row: { original: service } }) => (
          <div
            id={service.id}
            className='flex min-w-0 scroll-mt-[calc(var(--console-top-inset)+2rem)] items-center gap-3'
          >
            <div
              aria-hidden='true'
              className='flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary'
            >
              {service.icon}
            </div>
            <div className='grid min-w-0 gap-1'>
              {service.action.type === 'link' ? (
                <ResourceLink
                  href={service.action.href}
                  className='font-medium'
                >
                  {service.title}
                </ResourceLink>
              ) : (
                <Button
                  type='button'
                  disabled={disabled}
                  variant='link'
                  className='h-auto justify-start whitespace-normal p-0 text-left'
                  onClick={() => onActivate(service)}
                >
                  {service.title}
                </Button>
              )}
              <span
                className='line-clamp-2 text-xs text-foreground-muted'
                title={service.description}
              >
                {service.description}
              </span>
            </div>
          </div>
        )
      },
      {
        id: 'state',
        header: 'Status',
        size: 240,
        meta: { label: 'Status', skeleton: { kind: 'badge' } },
        cell: ({ row }) => (
          <div className='grid gap-1'>
            <StatusBadge
              className='w-fit whitespace-nowrap'
              tone={row.original.state.tone}
              title={row.original.state.description}
            >
              {row.original.state.label}
            </StatusBadge>
            {!['Healthy', 'Disabled'].includes(row.original.state.label) && row.original.state.description ? (
              <span className='line-clamp-2 text-xs text-foreground-muted'>{row.original.state.description}</span>
            ) : null}
          </div>
        )
      },
      {
        accessorKey: 'endpoint',
        header: 'Connection',
        size: 320,
        meta: { label: 'Connection', skeleton: { kind: 'stacked' } },
        cell: ({ row: { original: service } }) => (
          <div className='grid min-w-0 gap-1'>
            <span
              className='block truncate text-foreground-muted'
              title={service.endpoint ?? 'Not configured'}
            >
              {service.endpoint ?? 'Not configured'}
            </span>
            {service.timeoutMs !== null ? (
              <span className='text-xs tabular-nums text-foreground-muted'>
                {service.timeoutMs.toLocaleString('en-GB')} ms timeout
              </span>
            ) : null}
          </div>
        )
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 176,
        minSize: 176,
        enableHiding: false,
        enableSorting: false,
        enableResizing: false,
        meta: { label: 'Actions', skeleton: { kind: 'text', width: 'w-28' } },
        cell: ({ row }) => {
          const action = row.original.action
          if (action.type === 'link')
            return (
              <ResourceLink
                href={action.href}
                className='inline-flex min-h-8 items-center gap-2 whitespace-nowrap px-1 font-medium focus-visible:ring-inset'
              >
                {action.label}
                <IconArrowRight
                  aria-hidden='true'
                  className='size-4 shrink-0'
                />
              </ResourceLink>
            )
          return (
            <Button
              type='button'
              disabled={disabled}
              variant='link'
              size='sm'
              className='px-1'
              onClick={() => onEdit(action.serviceId)}
            >
              <IconPencil
                aria-hidden='true'
                className='size-4'
              />
              Edit
            </Button>
          )
        }
      }
    ],
    [disabled, onActivate, onEdit]
  )
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter(
      service =>
        !query ||
        `${service.title} ${service.description} ${service.endpoint ?? ''} ${service.state.label} ${service.settingsSummary}`
          .toLowerCase()
          .includes(query)
    )
  }, [rows, search])

  return (
    <DataGridWorkspace
      search={searchDraft}
      searchPlaceholder='Search services'
      onSearchChange={setSearchDraft}
      onSearch={setSearch}
      disabled={loading}
    >
      <DataGrid
        columns={columns}
        data={visibleRows}
        totalItems={visibleRows.length}
        pageIndex={0}
        pageSize={Math.max(visibleRows.length, 1)}
        getRowId={row => row.id}
        rowActivation={{
          getLabel: row => (row.action.type === 'edit' ? `Edit ${row.title}` : `${row.action.label} for ${row.title}`),
          onActivate: service => {
            if (!disabled) onActivate(service)
          }
        }}
        minWidth='61rem'
        loading={loading ? { rowCount: 5 } : false}
        emptyState={
          <DataGridEmptyState
            title='No services available'
            description='Services will appear here when they are available.'
          />
        }
      />
    </DataGridWorkspace>
  )
}
