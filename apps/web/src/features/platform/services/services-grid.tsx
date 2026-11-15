'use client'

import { useMemo, useState } from 'react'
import { IconArrowRight } from '@tabler/icons-react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ServiceConnectionLinks } from '@/shared/ui/platform/service-connection-links'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { ServiceRow } from './service-row'
import type { ColumnDef } from '@tanstack/react-table'
import styles from '@/shared/ui/data-grid/data-grid-table.module.css'

const detailsLabel = 'View details'
const serviceHealthNote = ({ state }: ServiceRow) =>
  ['Healthy', 'Disabled'].includes(state.label) ? undefined : state.description

export const ServicesGrid = ({
  rows,
  loadingRowCount,
  disabled = false,
  onActivate
}: {
  rows: ServiceRow[]
  loadingRowCount?: number
  disabled?: boolean
  onActivate: (service: ServiceRow) => void
}) => {
  const loading = loadingRowCount !== undefined
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const columns = useMemo<ColumnDef<ServiceRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Service',
        size: 320,
        enableHiding: false,
        meta: {
          label: 'Service',
          compactSlot: 'title',
          skeleton: {
            kind: 'custom',
            render: () => (
              <div className={cn('grid content-center gap-1', styles.settingsTouchTarget)}>
                <Skeleton className='h-5 w-36 max-w-full' />
                <Skeleton className={cn('h-4 w-2/3', styles.settingsWideOnly)} />
              </div>
            )
          }
        },
        cell: ({ row: { original: service } }) => (
          <div
            id={service.id}
            className='flex min-w-0 scroll-mt-[calc(var(--console-top-inset)+2rem)] items-center gap-3'
          >
            <div
              aria-hidden='true'
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary',
                styles.settingsWideOnly
              )}
            >
              {service.icon}
            </div>
            <div className='grid min-w-0 flex-1 gap-1'>
              <ResourceLink
                href={service.href}
                className={cn('flex items-center font-medium focus-visible:ring-inset', styles.settingsTouchTarget)}
              >
                {service.title}
              </ResourceLink>
              <span
                className={cn('line-clamp-2 text-xs text-foreground-muted', styles.settingsWideOnly)}
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
        enableHiding: false,
        meta: { label: 'Status', compactSlot: 'status', skeleton: { kind: 'badge' } },
        cell: ({ row: { original: service } }) => {
          const note = serviceHealthNote(service)
          return (
            <div className='grid justify-items-start gap-1'>
              <StatusBadge
                className='w-fit whitespace-nowrap'
                tone={service.state.tone}
                title={service.state.description}
              >
                {service.state.label}
              </StatusBadge>
              {note ? (
                <span className={cn('line-clamp-2 text-xs text-foreground-muted', styles.settingsWideOnly)}>
                  {note}
                </span>
              ) : null}
            </div>
          )
        }
      },
      {
        accessorKey: 'endpoint',
        header: 'Connection',
        size: 320,
        meta: {
          label: 'Connection',
          compactSlot: 'details',
          skeleton: {
            kind: 'custom',
            render: () => (
              <div
                className='grid gap-1'
                data-compact-empty
              >
                <Skeleton className='h-5 w-[78%]' />
                <Skeleton className='h-4 w-[42%] opacity-70' />
              </div>
            )
          }
        },
        cell: ({ row: { original: service } }) => {
          const note = serviceHealthNote(service)
          return (
            <>
              <div className={cn('grid min-w-0 gap-1', styles.settingsWideOnly)}>
                <span
                  className='block truncate text-foreground-muted'
                  title={service.endpoint ?? 'Not configured'}
                >
                  {service.endpoint ?? 'Not configured'}
                </span>
                {service.timeoutMs !== null || service.containerId ? (
                  <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1'>
                    {service.timeoutMs !== null ? (
                      <span className='text-xs tabular-nums text-foreground-muted'>
                        {service.timeoutMs.toLocaleString('en-GB')} ms timeout
                      </span>
                    ) : null}
                    <ServiceConnectionLinks
                      containerId={service.containerId}
                      serviceName={service.title}
                    />
                  </div>
                ) : null}
              </div>
              <p
                data-compact-empty={note ? undefined : true}
                className={cn('wrap-anywhere text-xs text-foreground-muted', styles.settingsOnly)}
              >
                {note}
              </p>
            </>
          )
        }
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
        cell: ({ row: { original: service } }) => (
          <ResourceLink
            href={service.href}
            className='inline-flex min-h-8 items-center gap-2 whitespace-nowrap px-1 font-medium focus-visible:ring-inset'
          >
            {detailsLabel}
            <IconArrowRight
              aria-hidden='true'
              className='size-4 shrink-0'
            />
          </ResourceLink>
        )
      }
    ],
    []
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
          getLabel: row => `${detailsLabel} for ${row.title}`,
          onActivate: service => {
            if (!disabled) onActivate(service)
          }
        }}
        minWidth='61rem'
        loading={loading ? { rowCount: loadingRowCount } : false}
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
