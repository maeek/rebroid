'use client'

import { createContext, useContext, useMemo } from 'react'
import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { MutationSwitch } from '@/components/ui/mutation-switch'
import { cn } from '@/lib/utils'
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
import type { StateViewAction } from '@/shared/ui/state-view'
import type { AutomationTag } from '@rebroid/automation-core/definition'
import type { CellContext, ColumnDef, SortingState } from '@tanstack/react-table'
import styles from '@/shared/ui/data-grid/data-grid-table.module.css'

const triggerEmptyState = (missingApps: boolean, missingWorkflows: boolean, canCreateApp: boolean) => {
  let action: StateViewAction | undefined
  if (missingWorkflows) action = { label: 'New workflow', href: '/automations/create' }
  else if (missingApps)
    action = canCreateApp ? { label: 'Create app', href: '/apps/create' } : { label: 'View apps', href: '/apps' }
  let description = 'Create a trigger to run a workflow on a schedule.'
  if (missingApps && missingWorkflows) description = 'A trigger needs a workflow and an app profile.'
  else if (missingWorkflows) description = 'Create a workflow before scheduling it with a trigger.'
  else if (missingApps) description = 'Choose an app you own to run the workflow on a schedule.'
  return (
    <DataGridEmptyState
      headingLevel={2}
      title='No triggers yet'
      description={description}
      actions={action ? [action] : undefined}
    />
  )
}

type TriggerSwitchActions = {
  busyId: string | null
  disabled: boolean
  toggleFeedback?: { pendingId: string | null; savedId: string | null }
  onToggleEnabled: (trigger: AutomationTrigger, enabled: boolean) => Promise<void>
}
const TriggerSwitchContext = createContext<TriggerSwitchActions | null>(null)
const TriggerEnabledCell = ({ row }: CellContext<AutomationTrigger, unknown>) => {
  const context = useContext(TriggerSwitchContext)
  if (!context) throw new Error('Trigger switches require their grid context.')
  const { busyId, disabled, toggleFeedback, onToggleEnabled } = context
  const busy = disabled || busyId === row.original.id
  return (
    <div className='flex items-center'>
      <MutationSwitch
        checked={row.original.enabled}
        pending={toggleFeedback?.pendingId === row.original.id}
        success={toggleFeedback?.savedId === row.original.id}
        disabled={busy}
        aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.name}`}
        onCheckedChange={enabled => void onToggleEnabled(row.original, enabled)}
      />
    </div>
  )
}

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
  canCreateApp,
  disabled = false,
  loading = false,
  missingApps,
  missingWorkflows,
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
  onToggleEnabled,
  toggleFeedback
}: {
  applicationById: Map<string, AndroidApplication>
  automationById: Map<string, Automation>
  busyId: string | null
  canCreateApp: boolean
  disabled?: boolean
  loading?: boolean
  missingApps: boolean
  missingWorkflows: boolean
  selectedIds: Set<string>
  sorting: SortingState
  triggers: AutomationTrigger[]
  onDelete: (trigger: AutomationTrigger) => void
  onDeleteSelected: () => void
  onDisableSelected: () => Promise<void>
  onEdit: (trigger: AutomationTrigger) => void
  onEnableSelected: () => Promise<void>
  onRun?: (trigger: AutomationTrigger) => Promise<void>
  onSelectedIdsChange: (ids: Set<string>) => void
  onSortingChange: (sorting: SortingState) => void
  toggleFeedback?: { pendingId: string | null; savedId: string | null }
  onToggleEnabled: (trigger: AutomationTrigger, enabled: boolean) => Promise<void>
}) {
  const columns = useMemo<ColumnDef<AutomationTrigger>[]>(
    () => [
      {
        id: 'name',
        accessorFn: trigger => trigger.name,
        header: 'Trigger',
        size: 352,
        enableHiding: false,
        meta: { compactSlot: 'title', label: 'Trigger', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => {
          const trigger = row.original
          const automation = automationById.get(trigger.automationId)
          return (
            <div className={`grid gap-1 ${styles.settingsStack}`}>
              <div className='flex flex-wrap items-center gap-2'>
                <button
                  type='button'
                  disabled={disabled}
                  onClick={() => onEdit(trigger)}
                  className={cn(
                    'text-left font-medium text-primary hover:underline',
                    'focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50',
                    styles.settingsTouchTarget
                  )}
                >
                  {trigger.name}
                </button>
              </div>
              <div className='grid gap-1'>
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
            </div>
          )
        }
      },
      {
        id: 'target',
        header: 'Target',
        size: 288,
        enableSorting: false,
        meta: { compactSlot: 'details', label: 'Target', skeleton: { kind: 'stacked', secondaryHeight: 'h-5' } },
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
        meta: { compactSlot: 'details', label: 'Schedule', skeleton: { kind: 'text', width: 'w-32' } },
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
        meta: { compactSlot: 'details', label: 'Last run', skeleton: { kind: 'stacked' } },
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
        meta: { compactSlot: 'control', label: 'Enabled', skeleton: { kind: 'text', width: 'w-12' } },
        cell: TriggerEnabledCell
      }
    ],
    [applicationById, automationById, disabled, onEdit]
  )

  return (
    <TriggerSwitchContext.Provider value={{ busyId, disabled, toggleFeedback, onToggleEnabled }}>
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
        emptyState={triggerEmptyState(missingApps, missingWorkflows, canCreateApp)}
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
                    <IconTrash className='size-4' />
                    Delete selected ({selectedIds.size})
                  </ContextMenuItem>
                </>
              ) : null}
              <ContextMenuItem
                disabled={disabled}
                onSelect={() => onEdit(row.original)}
              >
                <IconEdit className='size-4' />
                Edit
              </ContextMenuItem>
              {onRun ? (
                <ContextMenuItem
                  disabled={disabled}
                  onSelect={() => void onRun(row.original)}
                >
                  <IconPlayerPlayFilled className='size-4' />
                  Run now
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                disabled={disabled}
                className='text-danger focus:text-danger'
                onSelect={() => onDelete(row.original)}
              >
                <IconTrash className='size-4' />
                Delete
              </ContextMenuItem>
            </>
          )
        }}
      />
    </TriggerSwitchContext.Provider>
  )
}
