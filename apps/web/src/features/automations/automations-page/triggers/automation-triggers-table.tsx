'use client'

import { useMemo } from 'react'
import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Switch } from '@/components/ui/switch'
import { dateLabel, scheduleLabel } from '@/shared/model/schedule/schedule-format'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { AutomationTagBadge } from '../shared/automation-tag-badge'
import { getScheduleCron, statusLabel, statusVariant } from './automation-trigger-utils'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { Automation, AutomationTrigger } from '@/shared/contracts/automation'
import type { AutomationTag } from '@rebroid/automation-core/definition'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

function TriggerTags({ tags }: { tags: AutomationTag[] }) {
  return (
    <div className='flex flex-wrap gap-1'>
      {tags.length === 0 ? (
        <span className='text-sm text-foreground-muted'>-</span>
      ) : (
        tags.map(tag => (
          <AutomationTagBadge
            key={tag.name}
            tag={tag}
          />
        ))
      )}
    </div>
  )
}

export function AutomationTriggersTable({
  applicationById,
  automationById,
  busyId,
  selectedIds,
  sorting,
  triggers,
  onDelete,
  onDeleteSelected,
  onDisableSelected,
  onEdit,
  onEnableSelected,
  onRun,
  onSelectedIdsChange,
  onSortingChange,
  onToggleEnabled
}: {
  applicationById: Map<string, AndroidApplication>
  automationById: Map<string, Automation>
  busyId: string | null
  selectedIds: Set<string>
  sorting: SortingState
  triggers: AutomationTrigger[]
  onDelete: (trigger: AutomationTrigger) => void
  onDeleteSelected: () => void
  onDisableSelected: () => Promise<void>
  onEdit: (trigger: AutomationTrigger) => void
  onEnableSelected: () => Promise<void>
  onRun: (trigger: AutomationTrigger) => Promise<void>
  onSelectedIdsChange: (ids: Set<string>) => void
  onSortingChange: (sorting: SortingState) => void
  onToggleEnabled: (trigger: AutomationTrigger, enabled: boolean) => Promise<void>
}) {
  const columns = useMemo<ColumnDef<AutomationTrigger>[]>(
    () => [
      {
        id: 'name',
        accessorFn: trigger => trigger.name,
        header: 'Trigger',
        size: 352,
        meta: { label: 'Trigger', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => {
          const trigger = row.original
          const automation = automationById.get(trigger.automationId)
          return (
            <div className='grid gap-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium text-foreground'>{trigger.name}</span>
                <Badge variant='neutral'>Schedule</Badge>
                <Badge variant={statusVariant(trigger.lastStatus)}>{statusLabel(trigger.lastStatus)}</Badge>
              </div>
              <span className='truncate text-sm text-foreground-muted'>{automation?.name ?? trigger.automationId}</span>
              {trigger.lastError ? <span className='truncate text-sm text-danger'>{trigger.lastError}</span> : null}
            </div>
          )
        }
      },
      {
        id: 'tags',
        header: 'Tags',
        size: 176,
        enableSorting: false,
        meta: { label: 'Tags', skeleton: { kind: 'badge' } },
        cell: ({ row }) => <TriggerTags tags={row.original.tags} />
      },
      {
        id: 'target',
        header: 'Target',
        size: 288,
        enableSorting: false,
        meta: { label: 'Target', skeleton: { kind: 'stacked', secondaryHeight: 'h-5' } },
        cell: ({ row }) => {
          const trigger = row.original
          const application = applicationById.get(trigger.targetApplicationId)
          return (
            <div className='grid gap-1 text-sm text-foreground-muted'>
              <span className='truncate text-foreground'>{application?.name ?? trigger.targetApplicationId}</span>
              <span className='truncate'>
                {trigger.profileName ?? 'default'} / {trigger.profileMode ?? 'persistent'}
              </span>
            </div>
          )
        }
      },
      {
        id: 'schedule',
        header: 'Schedule',
        size: 176,
        enableSorting: false,
        meta: { label: 'Schedule', skeleton: { kind: 'text', width: 'w-32' } },
        cell: ({ row }) => (
          <span className='text-sm text-foreground-muted'>{scheduleLabel(getScheduleCron(row.original))}</span>
        )
      },
      {
        id: 'nextRunAt',
        accessorFn: trigger => trigger.nextRunAt ?? '',
        header: 'Next run',
        size: 176,
        meta: { label: 'Next run', skeleton: { kind: 'text', width: 'w-32' } },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{dateLabel(row.original.nextRunAt)}</span>
      },
      {
        id: 'lastRunAt',
        accessorFn: trigger => trigger.lastRunAt ?? '',
        header: 'Last trace',
        size: 176,
        meta: { label: 'Last trace', skeleton: { kind: 'text', width: 'w-32' } },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{dateLabel(row.original.lastRunAt)}</span>
      },
      {
        id: 'enabled',
        accessorFn: trigger => String(trigger.enabled),
        header: 'Enabled',
        size: 128,
        meta: { label: 'Enabled', skeleton: { kind: 'text', width: 'w-12' } },
        cell: ({ row }) => {
          const busy = busyId === row.original.id
          return (
            <div className='flex justify-center'>
              <Switch
                checked={row.original.enabled}
                disabled={busy}
                aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.name}`}
                onCheckedChange={enabled => void onToggleEnabled(row.original, enabled)}
              />
            </div>
          )
        }
      }
    ],
    [applicationById, automationById, busyId, onToggleEnabled]
  )

  return (
    <DataGrid
      columns={columns}
      data={triggers}
      totalItems={triggers.length}
      pageIndex={0}
      pageSize={triggers.length || 20}
      getRowId={trigger => trigger.id}
      sorting={sorting}
      onSortingChange={updater => onSortingChange(typeof updater === 'function' ? updater(sorting) : updater)}
      selection={{
        selectedIds,
        onSelectedIdsChange
      }}
      minWidth='86rem'
      emptyState={<div className='text-center text-foreground-muted'>No triggers match the current filters.</div>}
      rowContextMenu={row => {
        const hasBulkSelection = selectedIds.has(row.original.id) && selectedIds.size > 1
        return (
          <>
            {hasBulkSelection ? (
              <>
                <ContextMenuItem onSelect={() => void onEnableSelected()}>
                  Enable selected ({selectedIds.size})
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => void onDisableSelected()}>
                  Disable selected ({selectedIds.size})
                </ContextMenuItem>
                <ContextMenuItem
                  className='text-danger focus:text-danger'
                  onSelect={onDeleteSelected}
                >
                  <IconTrash className='mr-2 size-4' />
                  Delete selected ({selectedIds.size})
                </ContextMenuItem>
              </>
            ) : null}
            <ContextMenuItem onSelect={() => onEdit(row.original)}>
              <IconEdit className='mr-2 size-4' />
              Edit
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void onRun(row.original)}>
              <IconPlayerPlayFilled className='mr-2 size-4' />
              Run now
            </ContextMenuItem>
            <ContextMenuItem
              className='text-danger focus:text-danger'
              onSelect={() => onDelete(row.original)}
            >
              <IconTrash className='mr-2 size-4' />
              Delete
            </ContextMenuItem>
          </>
        )
      }}
    />
  )
}
