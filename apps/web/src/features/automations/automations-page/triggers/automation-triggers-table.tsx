'use client'

import { useMemo } from 'react'
import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { DataGrid } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Switch } from '@/components/ui/switch'
import { dateLabel, scheduleLabel } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import { AutomationTagBadge } from '../shared/automation-tag-badge'
import { getScheduleCron, statusLabel, statusVariant } from './automation-trigger-utils'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { Automation, AutomationTag, AutomationTrigger } from '@/server/orchestrator/automations/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

function TriggerTags({ tags }: { tags: AutomationTag[] }) {
  return (
    <div className='flex flex-wrap gap-1'>
      {tags.length === 0 ? (
        <span className='text-sm text-secondary-foreground'>-</span>
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
        meta: { label: 'Trigger' },
        cell: ({ row }) => {
          const trigger = row.original
          const automation = automationById.get(trigger.automationId)
          return (
            <div className='grid gap-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium text-foreground'>{trigger.name}</span>
                <Badge variant='secondary'>Schedule</Badge>
                <Badge variant={statusVariant(trigger.lastStatus)}>{statusLabel(trigger.lastStatus)}</Badge>
              </div>
              <span className='truncate text-sm text-secondary-foreground'>
                {automation?.name ?? trigger.automationId}
              </span>
              {trigger.lastError ? (
                <span className='truncate text-sm text-destructive'>{trigger.lastError}</span>
              ) : null}
            </div>
          )
        }
      },
      {
        id: 'tags',
        header: 'Tags',
        size: 176,
        enableSorting: false,
        meta: { label: 'Tags' },
        cell: ({ row }) => <TriggerTags tags={row.original.tags} />
      },
      {
        id: 'target',
        header: 'Target',
        size: 288,
        enableSorting: false,
        meta: { label: 'Target' },
        cell: ({ row }) => {
          const trigger = row.original
          const application = applicationById.get(trigger.targetApplicationId)
          return (
            <div className='grid gap-1 text-sm text-secondary-foreground'>
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
        meta: { label: 'Schedule' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{scheduleLabel(getScheduleCron(row.original))}</span>
        )
      },
      {
        id: 'nextRunAt',
        accessorFn: trigger => trigger.nextRunAt ?? '',
        header: 'Next run',
        size: 176,
        meta: { label: 'Next run' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{dateLabel(row.original.nextRunAt)}</span>
        )
      },
      {
        id: 'lastRunAt',
        accessorFn: trigger => trigger.lastRunAt ?? '',
        header: 'Last trace',
        size: 176,
        meta: { label: 'Last trace' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{dateLabel(row.original.lastRunAt)}</span>
        )
      },
      {
        id: 'enabled',
        accessorFn: trigger => String(trigger.enabled),
        header: 'Enabled',
        size: 128,
        meta: { label: 'Enabled' },
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
      emptyState={<div className='text-center text-secondary-foreground'>No triggers match the current filters.</div>}
      mobileCard={row => {
        const trigger = row.original
        const automation = automationById.get(trigger.automationId)
        const application = applicationById.get(trigger.targetApplicationId)
        const busy = busyId === trigger.id
        return (
          <div
            key={trigger.id}
            className='grid gap-4 rounded-lg border border-border/70 bg-background/25 p-4'
          >
            <div className='flex min-w-0 items-start justify-between gap-3'>
              <Checkbox
                checked={selectedIds.has(trigger.id)}
                aria-label={`Select ${trigger.name}`}
                onCheckedChange={checked => {
                  const next = new Set(selectedIds)
                  if (checked === true) next.add(trigger.id)
                  else next.delete(trigger.id)
                  onSelectedIdsChange(next)
                }}
              />
              <div className='min-w-0 flex-1'>
                <h3 className='font-medium text-foreground'>{trigger.name}</h3>
                <p className='mt-1 text-sm text-secondary-foreground'>{automation?.name ?? trigger.automationId}</p>
              </div>
              <Switch
                checked={trigger.enabled}
                disabled={busy}
                aria-label={`${trigger.enabled ? 'Disable' : 'Enable'} ${trigger.name}`}
                onCheckedChange={enabled => void onToggleEnabled(trigger, enabled)}
              />
            </div>
            <div className='flex flex-wrap gap-2'>
              <Badge variant={trigger.enabled ? 'status' : 'secondary'}>{trigger.enabled ? 'Enabled' : 'Paused'}</Badge>
              <Badge variant={statusVariant(trigger.lastStatus)}>{statusLabel(trigger.lastStatus)}</Badge>
              {trigger.tags.map(tag => (
                <AutomationTagBadge
                  key={tag.name}
                  tag={tag}
                />
              ))}
            </div>
            <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
              <div className='col-span-2 grid gap-1'>
                <dt className='text-secondary-foreground'>Target</dt>
                <dd className='text-foreground'>
                  {application?.name ?? trigger.targetApplicationId} / {trigger.profileName ?? 'default'}
                </dd>
              </div>
              <div className='col-span-2 grid gap-1'>
                <dt className='text-secondary-foreground'>Schedule</dt>
                <dd className='text-foreground'>{scheduleLabel(getScheduleCron(trigger))}</dd>
              </div>
              <div className='grid gap-1'>
                <dt className='text-secondary-foreground'>Next</dt>
                <dd className='text-foreground'>{dateLabel(trigger.nextRunAt)}</dd>
              </div>
              <div className='grid gap-1'>
                <dt className='text-secondary-foreground'>Last</dt>
                <dd className='text-foreground'>{dateLabel(trigger.lastRunAt)}</dd>
              </div>
              {trigger.lastError ? (
                <div className='col-span-2 grid gap-1'>
                  <dt className='text-secondary-foreground'>Error</dt>
                  <dd className='text-destructive'>{trigger.lastError}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        )
      }}
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
                  className='text-destructive focus:text-destructive'
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
              className='text-destructive focus:text-destructive'
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
