'use client'

import { useMemo } from 'react'
import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Switch } from '@/components/ui/switch'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import { ScheduleValue } from '@/shared/ui/schedule/schedule-value'
import { AutomationTagBadge } from '../shared/automation-tag-badge'
import { WorkflowRunResult } from '../shared/workflow-run-result'
import { getScheduleCron } from './automation-trigger-utils'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { Automation, AutomationTrigger } from '@/shared/contracts/automation'
import type { AutomationTag } from '@rebroid/automation-core/definition'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

function TriggerTags({ tags }: { tags: AutomationTag[] }) {
  if (tags.length === 0) return null
  return (
    <div className='flex flex-wrap gap-1'>
      {tags.map(tag => (
        <AutomationTagBadge
          key={tag.name}
          tag={tag}
        />
      ))}
    </div>
  )
}

export function AutomationTriggersTable({
  applicationById,
  automationById,
  busyId,
  disabled = false,
  loading = false,
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
  disabled?: boolean
  loading?: boolean
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
                <button
                  type='button'
                  disabled={disabled}
                  onClick={() => onEdit(trigger)}
                  className='text-left font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50'
                >
                  {trigger.name}
                </button>
              </div>
              {trigger.description ? (
                <p className='line-clamp-2 text-xs text-foreground-muted'>{trigger.description}</p>
              ) : null}
              <ResourceLink
                href={`/automations/${encodeURIComponent(trigger.automationId)}`}
                className='truncate text-xs'
              >
                {automation?.name ?? trigger.automationId}
              </ResourceLink>
              <TriggerTags tags={trigger.tags} />
            </div>
          )
        }
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
              <ResourceLink
                href={`/app/${encodeURIComponent(trigger.targetApplicationId)}`}
                className='truncate'
              >
                {application?.name ?? trigger.targetApplicationId}
              </ResourceLink>
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
        cell: ({ row }) => <ScheduleValue expression={getScheduleCron(row.original)} />
      },
      {
        id: 'nextRunAt',
        accessorFn: trigger => trigger.nextRunAt ?? '',
        header: 'Next run',
        size: 176,
        meta: { label: 'Next run', skeleton: { kind: 'text', width: 'w-32' } },
        cell: ({ row }) => (
          <DateTimeValue
            value={row.original.enabled ? row.original.nextRunAt : null}
            emptyLabel='No run scheduled'
          />
        )
      },
      {
        id: 'lastRunAt',
        accessorFn: trigger => trigger.lastRunAt ?? '',
        header: 'Last run',
        size: 176,
        meta: { label: 'Last run', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <WorkflowRunResult
            status={row.original.lastStatus}
            at={row.original.lastRunAt}
            error={row.original.lastError}
            workflowId={row.original.automationId}
            runId={row.original.lastRunId}
          />
        )
      },
      {
        id: 'enabled',
        accessorFn: trigger => String(trigger.enabled),
        header: 'Enabled',
        size: 128,
        meta: { label: 'Enabled', skeleton: { kind: 'text', width: 'w-12' } },
        cell: ({ row }) => {
          const busy = disabled || busyId === row.original.id
          return (
            <div className='flex items-center'>
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
    [applicationById, automationById, busyId, disabled, onEdit, onToggleEnabled]
  )

  return (
    <DataGrid
      loading={loading}
      columns={columns}
      data={triggers}
      totalItems={triggers.length}
      pageIndex={0}
      pageSize={triggers.length || 20}
      getRowId={trigger => trigger.id}
      sorting={sorting}
      onSortingChange={updater => onSortingChange(typeof updater === 'function' ? updater(sorting) : updater)}
      selection={{
        disabled,
        selectedIds,
        onSelectedIdsChange
      }}
      minWidth='72rem'
      emptyState={
        <DataGridEmptyState
          title='No triggers yet'
          description='Create a trigger to run a workflow on a schedule.'
        />
      }
      rowContextMenu={row => {
        const hasBulkSelection = selectedIds.has(row.original.id) && selectedIds.size > 1
        return (
          <>
            {hasBulkSelection ? (
              <>
                <ContextMenuItem
                  disabled={disabled}
                  onSelect={() => void onEnableSelected()}
                >
                  Enable selected ({selectedIds.size})
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={disabled}
                  onSelect={() => void onDisableSelected()}
                >
                  Disable selected ({selectedIds.size})
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={disabled}
                  className='text-danger focus:text-danger'
                  onSelect={onDeleteSelected}
                >
                  <IconTrash className='mr-2 size-4' />
                  Delete selected ({selectedIds.size})
                </ContextMenuItem>
              </>
            ) : null}
            <ContextMenuItem
              disabled={disabled}
              onSelect={() => onEdit(row.original)}
            >
              <IconEdit className='mr-2 size-4' />
              Edit
            </ContextMenuItem>
            <ContextMenuItem
              disabled={disabled}
              onSelect={() => void onRun(row.original)}
            >
              <IconPlayerPlayFilled className='mr-2 size-4' />
              Run now
            </ContextMenuItem>
            <ContextMenuItem
              disabled={disabled}
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
