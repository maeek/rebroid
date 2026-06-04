'use client'

import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { dateLabel, scheduleLabel } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import { getScheduleCron, statusLabel, statusVariant } from './automation-trigger-utils'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { Automation, AutomationTrigger } from '@/server/orchestrator/automations/types'

export function AutomationTriggersTable({
  applicationById,
  automationById,
  allSelected,
  busyId,
  selectedIds,
  triggers,
  onDelete,
  onEdit,
  onRun,
  onToggleAll,
  onToggleEnabled,
  onToggleSelected
}: {
  applicationById: Map<string, AndroidApplication>
  automationById: Map<string, Automation>
  allSelected: boolean
  busyId: string | null
  selectedIds: Set<string>
  triggers: AutomationTrigger[]
  onDelete: (trigger: AutomationTrigger) => void
  onEdit: (trigger: AutomationTrigger) => void
  onRun: (trigger: AutomationTrigger) => Promise<void>
  onToggleAll: () => void
  onToggleEnabled: (trigger: AutomationTrigger, enabled: boolean) => Promise<void>
  onToggleSelected: (id: string) => void
}) {
  return (
    <>
      <div className='hidden overflow-hidden rounded-lg border border-border/60 bg-background/25 lg:block'>
        <div className='overflow-x-auto'>
          <Table
            className='table-fixed'
            style={{ minWidth: '86rem' }}
          >
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-12 px-4 py-3'>
                  <Checkbox
                    checked={allSelected}
                    aria-label='Select all triggers'
                    onCheckedChange={onToggleAll}
                  />
                </TableHead>
                <TableHead className='w-[22rem] px-4 py-3 uppercase'>Trigger</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Tags</TableHead>
                <TableHead className='w-[18rem] px-4 py-3 uppercase'>Target</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Schedule</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Next run</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Last trace</TableHead>
                <TableHead className='w-28 px-4 py-3 text-center uppercase'>Enabled</TableHead>
                <TableHead className='w-48 px-4 py-3 text-right uppercase'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {triggers.map(trigger => {
                const automation = automationById.get(trigger.automationId)
                const application = applicationById.get(trigger.targetApplicationId)
                const busy = busyId === trigger.id

                return (
                  <TableRow
                    key={trigger.id}
                    className='hover:bg-secondary/22'
                  >
                    <TableCell className='px-4 py-3 align-top'>
                      <Checkbox
                        checked={selectedIds.has(trigger.id)}
                        aria-label={`Select ${trigger.name}`}
                        onCheckedChange={() => onToggleSelected(trigger.id)}
                      />
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='grid gap-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className='font-medium text-foreground'>{trigger.name}</span>
                          <Badge variant='secondary'>Schedule</Badge>
                          <Badge variant={statusVariant(trigger.lastStatus)}>{statusLabel(trigger.lastStatus)}</Badge>
                        </div>
                        <span className='truncate text-sm text-secondary-foreground'>
                          {automation?.name ?? trigger.automationId}
                        </span>
                        <Visible when={trigger.lastError}>
                          <span className='truncate text-sm text-destructive'>{trigger.lastError}</span>
                        </Visible>
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <TriggerTags tags={trigger.tags} />
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      <div className='grid gap-1'>
                        <span className='truncate text-foreground'>
                          {application?.name ?? trigger.targetApplicationId}
                        </span>
                        <span className='truncate'>
                          {trigger.profileName ?? 'default'} / {trigger.profileMode ?? 'persistent'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {scheduleLabel(getScheduleCron(trigger))}
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {dateLabel(trigger.nextRunAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {dateLabel(trigger.lastRunAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-center align-top'>
                      <Switch
                        checked={trigger.enabled}
                        disabled={busy}
                        aria-label={`${trigger.enabled ? 'Disable' : 'Enable'} ${trigger.name}`}
                        onCheckedChange={enabled => void onToggleEnabled(trigger, enabled)}
                      />
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <TriggerRowActions
                        busy={busy}
                        trigger={trigger}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onRun={onRun}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
              <Visible when={triggers.length === 0}>
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className='px-4 py-8 text-center text-secondary-foreground'
                  >
                    No triggers match the current filters.
                  </TableCell>
                </TableRow>
              </Visible>
            </TableBody>
          </Table>
        </div>
      </div>
      <AutomationTriggersMobileList
        applicationById={applicationById}
        automationById={automationById}
        busyId={busyId}
        selectedIds={selectedIds}
        triggers={triggers}
        onDelete={onDelete}
        onEdit={onEdit}
        onRun={onRun}
        onToggleEnabled={onToggleEnabled}
        onToggleSelected={onToggleSelected}
      />
    </>
  )
}

function AutomationTriggersMobileList({
  applicationById,
  automationById,
  busyId,
  selectedIds,
  triggers,
  onDelete,
  onEdit,
  onRun,
  onToggleEnabled,
  onToggleSelected
}: Omit<Parameters<typeof AutomationTriggersTable>[0], 'allSelected' | 'onToggleAll'>) {
  return (
    <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25 lg:hidden'>
      {triggers.map(trigger => {
        const automation = automationById.get(trigger.automationId)
        const application = applicationById.get(trigger.targetApplicationId)
        const busy = busyId === trigger.id

        return (
          <div
            key={trigger.id}
            className='grid gap-4 border-b border-border/60 px-4 py-4 last:border-b-0'
          >
            <div className='flex min-w-0 items-start justify-between gap-3'>
              <Checkbox
                checked={selectedIds.has(trigger.id)}
                aria-label={`Select ${trigger.name}`}
                onCheckedChange={() => onToggleSelected(trigger.id)}
              />
              <div className='min-w-0'>
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
                <Badge
                  key={tag}
                  variant='secondary'
                >
                  {tag}
                </Badge>
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
              <Visible when={trigger.lastError}>
                <div className='col-span-2 grid gap-1'>
                  <dt className='text-secondary-foreground'>Error</dt>
                  <dd className='text-destructive'>{trigger.lastError}</dd>
                </div>
              </Visible>
            </dl>
            <div className='flex flex-wrap gap-2'>
              <Button
                size='sm'
                variant='secondary'
                disabled={busy}
                onClick={() => onEdit(trigger)}
              >
                <IconEdit className='size-4' />
                Edit
              </Button>
              <Button
                size='sm'
                variant='secondary'
                disabled={busy}
                onClick={() => void onRun(trigger)}
              >
                <IconPlayerPlayFilled className='size-4' />
                Run now
              </Button>
              <Button
                size='sm'
                variant='ghost'
                disabled={busy}
                onClick={() => onDelete(trigger)}
              >
                <IconTrash className='size-4 text-destructive' />
                Delete
              </Button>
            </div>
          </div>
        )
      })}
      <Visible when={triggers.length === 0}>
        <div className='px-4 py-8 text-center text-sm text-secondary-foreground'>
          No triggers match the current filters.
        </div>
      </Visible>
    </div>
  )
}

function TriggerTags({ tags }: { tags: string[] }) {
  return (
    <div className='flex flex-wrap gap-1'>
      {tags.length === 0 ? (
        <span className='text-sm text-secondary-foreground'>-</span>
      ) : (
        tags.map(tag => (
          <Badge
            key={tag}
            variant='secondary'
          >
            {tag}
          </Badge>
        ))
      )}
    </div>
  )
}

function TriggerRowActions({
  busy,
  trigger,
  onDelete,
  onEdit,
  onRun
}: {
  busy: boolean
  trigger: AutomationTrigger
  onDelete: (trigger: AutomationTrigger) => void
  onEdit: (trigger: AutomationTrigger) => void
  onRun: (trigger: AutomationTrigger) => Promise<void>
}) {
  return (
    <div className='flex justify-end gap-2'>
      <Button
        size='sm'
        variant='ghost'
        disabled={busy}
        onClick={() => onEdit(trigger)}
      >
        <IconEdit className='size-4' />
        Edit
      </Button>
      <Button
        size='sm'
        variant='ghost'
        disabled={busy}
        onClick={() => void onRun(trigger)}
      >
        <IconPlayerPlayFilled className='size-4' />
        Run
      </Button>
      <Button
        size='sm'
        variant='ghost'
        aria-label={`Delete ${trigger.name}`}
        disabled={busy}
        onClick={() => onDelete(trigger)}
      >
        <IconTrash className='size-4 text-destructive' />
      </Button>
    </div>
  )
}
