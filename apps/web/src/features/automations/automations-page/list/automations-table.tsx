'use client'

import { useMemo, useState } from 'react'
import { IconActivityHeartbeat, IconDotsVertical, IconSearch, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { deleteAutomationAction } from '@/server/orchestrator/automations/actions'
import { AutomationDeleteDialog } from '../shared/automation-delete-dialog'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { Automation, AutomationDefinitionStep, AutomationTrigger } from '@/server/orchestrator/automations/types'

type LastRunFilter = 'all' | 'never' | '7d' | '30d' | '90d'

const statusVariant = (status: Automation['lastStatus']) => {
  if (status === 'success') return 'status'
  if (status === 'failed') return 'destructive'
  return 'secondary'
}

const statusLabel = (status: Automation['lastStatus']) => {
  if (status === 'never_run') return 'Never run'
  return status === 'success' ? 'Success' : status === 'running' ? 'Running' : 'Failed'
}

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : '-'

const stepCount = (steps: AutomationDefinitionStep[]): number =>
  steps.reduce((count, step) => {
    if ('uses' in step) return count + 1
    if (step.type === 'condition') return count + 1 + stepCount(step.then) + stepCount(step.else ?? [])
    if (step.type === 'switch') {
      return (
        count + 1 + step.cases.reduce((sum, item) => sum + stepCount(item.steps), 0) + stepCount(step.default ?? [])
      )
    }
    return count + 1 + stepCount(step.steps)
  }, 0)

const matchesLastRun = (automation: Automation, filter: LastRunFilter) => {
  if (filter === 'all') return true
  if (filter === 'never') return automation.lastRunAt === null
  if (!automation.lastRunAt) return false
  const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90
  return new Date(automation.lastRunAt).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000
}

export function AutomationsTable({
  applications,
  automations: initialAutomations,
  triggers
}: {
  applications: AndroidApplication[]
  automations: Automation[]
  triggers: AutomationTrigger[]
}) {
  const router = useRouter()
  const [automations, setAutomations] = useState(initialAutomations)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('all')
  const [appFilter, setAppFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [lastRunFilter, setLastRunFilter] = useState<LastRunFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const appNameById = useMemo(() => new Map(applications.map(app => [app.id, app.name])), [applications])
  const automationAppIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const trigger of triggers) {
      const set = map.get(trigger.automationId) ?? new Set<string>()
      set.add(trigger.targetApplicationId)
      map.set(trigger.automationId, set)
    }
    return map
  }, [triggers])
  const tags = useMemo(
    () =>
      Array.from(new Set(automations.flatMap(automation => automation.tags))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [automations]
  )
  const filteredAutomations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return automations.filter(automation => {
      const appIds = automationAppIds.get(automation.id) ?? new Set()
      return (
        (!query ||
          automation.name.toLowerCase().includes(query) ||
          (automation.description ?? '').toLowerCase().includes(query)) &&
        (tagFilter === 'all' || automation.tags.includes(tagFilter)) &&
        (appFilter === 'all' || appIds.has(appFilter)) &&
        (statusFilter === 'all' || automation.lastStatus === statusFilter) &&
        matchesLastRun(automation, lastRunFilter)
      )
    })
  }, [appFilter, automationAppIds, automations, lastRunFilter, search, statusFilter, tagFilter])

  const selectedAutomations = filteredAutomations.filter(automation => selectedIds.has(automation.id))
  const allSelected = filteredAutomations.length > 0 && selectedAutomations.length === filteredAutomations.length

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredAutomations.map(item => item.id)))
  }

  const deleteMany = async (items: Automation[]) => {
    setBusy(true)
    const results = await Promise.allSettled(items.map(item => deleteAutomationAction(item.id)))
    const deletedIds = new Set(
      results
        .map((result, index) => (result.status === 'fulfilled' ? items[index]?.id : null))
        .filter((id): id is string => Boolean(id))
    )
    const failedCount = results.length - deletedIds.size
    setAutomations(current => current.filter(item => !deletedIds.has(item.id)))
    setSelectedIds(current => new Set(Array.from(current).filter(id => !deletedIds.has(id))))
    setPendingDelete(null)
    setBulkDeleteOpen(false)
    setBusy(false)
    toast(
      failedCount > 0
        ? {
            title: 'Some workflows could not be deleted',
            description: `${failedCount} delete request failed.`,
            variant: 'destructive'
          }
        : { title: items.length === 1 ? 'Workflow deleted' : 'Selected workflows deleted' }
    )
  }

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative min-w-60 flex-1'>
          <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-foreground' />
          <Input
            value={search}
            placeholder='Search workflows'
            className='pl-9'
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={tagFilter}
          onValueChange={setTagFilter}
        >
          <SelectTrigger className='w-44'>
            <SelectValue placeholder='Tag' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All tags</SelectItem>
            {tags.map(tag => (
              <SelectItem
                key={tag}
                value={tag}
              >
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={appFilter}
          onValueChange={setAppFilter}
        >
          <SelectTrigger className='w-52'>
            <SelectValue placeholder='App' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All apps</SelectItem>
            {applications.map(app => (
              <SelectItem
                key={app.id}
                value={app.id}
              >
                {app.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='Status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All status</SelectItem>
            <SelectItem value='never_run'>Never run</SelectItem>
            <SelectItem value='running'>Running</SelectItem>
            <SelectItem value='success'>Success</SelectItem>
            <SelectItem value='failed'>Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={lastRunFilter}
          onValueChange={value => setLastRunFilter(value as LastRunFilter)}
        >
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='Last run' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Any run</SelectItem>
            <SelectItem value='never'>Never run</SelectItem>
            <SelectItem value='7d'>Last 7 days</SelectItem>
            <SelectItem value='30d'>Last 30 days</SelectItem>
            <SelectItem value='90d'>Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Visible when={selectedAutomations.length > 0}>
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input bg-card/40 px-4 py-3 text-sm'>
          <span className='text-secondary-foreground'>{selectedAutomations.length} selected</span>
          <Button
            size='sm'
            variant='destructive'
            disabled={busy}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <IconTrash className='size-4' />
            Delete
          </Button>
        </div>
      </Visible>

      <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
        <div className='overflow-x-auto'>
          <Table
            className='table-fixed'
            style={{ minWidth: '72rem' }}
          >
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-12 px-4 py-3'>
                  <Checkbox
                    checked={allSelected}
                    aria-label='Select all workflows'
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className='w-md px-4 py-3 uppercase'>Workflow</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Tags</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Apps</TableHead>
                <TableHead className='w-28 px-4 py-3 uppercase'>Steps</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Last run</TableHead>
                <TableHead className='w-32 px-4 py-3 uppercase'>Status</TableHead>
                <TableHead className='w-16 px-4 py-3 text-right uppercase'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAutomations.map(automation => {
                const count = stepCount(automation.definition.spec.steps)
                const href = `/automations/${automation.id}`
                const appIds = Array.from(automationAppIds.get(automation.id) ?? [])

                return (
                  <TableRow
                    key={automation.id}
                    role='link'
                    tabIndex={0}
                    className='cursor-pointer hover:bg-secondary/22 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
                    onClick={() => router.push(href)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        router.push(href)
                      }
                    }}
                  >
                    <TableCell
                      className='px-4 py-3 align-top'
                      onClick={event => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(automation.id)}
                        aria-label={`Select ${automation.name}`}
                        onCheckedChange={() => toggleSelected(automation.id)}
                      />
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='grid gap-1'>
                        <Link
                          href={href}
                          className='font-medium text-foreground hover:text-primary'
                          onClick={event => event.stopPropagation()}
                        >
                          {automation.name}
                        </Link>
                        <span className='line-clamp-1 text-sm text-secondary-foreground'>
                          {automation.description || 'No description'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='flex flex-wrap gap-1'>
                        {automation.tags.length === 0 ? (
                          <span className='text-sm text-secondary-foreground'>-</span>
                        ) : (
                          automation.tags.map(tag => (
                            <Badge
                              key={tag}
                              variant='secondary'
                            >
                              {tag}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {appIds.length === 0 ? '-' : appIds.map(id => appNameById.get(id) ?? id).join(', ')}
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {count} {count === 1 ? 'step' : 'steps'}
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                      {formatDate(automation.lastRunAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <Badge variant={statusVariant(automation.lastStatus)}>{statusLabel(automation.lastStatus)}</Badge>
                    </TableCell>
                    <TableCell className='px-4 py-3 align-top'>
                      <div className='flex justify-end'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type='button'
                              size='icon'
                              variant='ghost'
                              aria-label={`More actions for ${automation.name}`}
                              onClick={event => event.stopPropagation()}
                            >
                              <IconDotsVertical className='size-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align='end'
                            className='min-w-40 p-2'
                            onClick={event => event.stopPropagation()}
                          >
                            <DropdownMenuItem
                              className='gap-2 px-3 py-2'
                              onSelect={() => router.push(`${href}/traces`)}
                            >
                              <IconActivityHeartbeat className='size-4' />
                              Traces
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className='gap-2 px-3 py-2 text-red-300'
                              onSelect={() => setPendingDelete(automation)}
                            >
                              <IconTrash className='size-4' />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              <Visible when={filteredAutomations.length === 0}>
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className='px-4 py-8 text-center text-secondary-foreground'
                  >
                    No workflows match the current filters.
                  </TableCell>
                </TableRow>
              </Visible>
            </TableBody>
          </Table>
        </div>
      </div>

      <AutomationDeleteDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.name ?? 'workflow'}?`}
        description='This removes the workflow and its triggers.'
        busy={busy}
        onOpenChange={open => !open && setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMany([pendingDelete])}
      />
      <AutomationDeleteDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedAutomations.length} selected workflows?`}
        description='This removes the selected workflows and their triggers.'
        busy={busy}
        onOpenChange={open => !open && setBulkDeleteOpen(false)}
        onConfirm={() => deleteMany(selectedAutomations)}
      />
    </div>
  )
}
