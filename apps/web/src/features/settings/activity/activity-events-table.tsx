'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  IconAdjustmentsHorizontal,
  IconCalendarStats,
  IconClock,
  IconDatabaseExport,
  IconDotsVertical,
  IconDownload,
  IconEye,
  IconFilter,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconTrash,
  IconX
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlatformGridPagination } from '@/features/orchestrator/components/platform-grid-pagination'
import { toast } from '@/hooks/use-toast'
import { purgeAllAuditEventsAction, saveAuditRetentionAction } from '@/server/audit/actions'
import type { AuditEvent, AuditEventPage } from '@/server/storage/database'

type ActivityFilterValues = {
  search?: string
  actor?: string
  category?: string
  action?: string
  resourceType?: string
  outcome?: string
  from?: string
  to?: string
}

type ActivityFacets = {
  actors: Array<{ id: string; label: string }>
  categories: string[]
  actions: string[]
  resourceTypes: string[]
}

const allValue = '__all__'

const formatAction = (action: string) =>
  action
    .split('.')
    .map(value => value.charAt(0).toUpperCase() + value.slice(1))
    .join(' ')

const formatDetails = (details: Record<string, unknown>) =>
  Object.keys(details).length === 0 ? 'none' : JSON.stringify(details, null, 2)

const dateInputValue = (value: string | undefined) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const compactParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text) params.set(key, text)
  }
  return params
}

const filterEntries = (filters: ActivityFilterValues, facets: ActivityFacets) => {
  const actorLabel = filters.actor ? facets.actors.find(actor => actor.id === filters.actor)?.label : undefined
  return [
    filters.search && { key: 'search', label: 'Search', value: filters.search },
    filters.actor && { key: 'actor', label: 'Actor', value: actorLabel ?? filters.actor },
    filters.category && { key: 'category', label: 'Category', value: filters.category },
    filters.action && { key: 'action', label: 'Action', value: formatAction(filters.action) },
    filters.resourceType && { key: 'resourceType', label: 'Resource', value: filters.resourceType },
    filters.outcome && { key: 'outcome', label: 'Outcome', value: filters.outcome },
    filters.from && { key: 'from', label: 'From', value: dateInputValue(filters.from) },
    filters.to && { key: 'to', label: 'To', value: dateInputValue(filters.to) }
  ].filter(Boolean) as Array<{ key: keyof ActivityFilterValues; label: string; value: string }>
}

const outcomeTone = (outcome: AuditEvent['outcome']) => (outcome === 'failure' ? 'destructive' : 'secondary')

const metricNumber = (value: number) => new Intl.NumberFormat().format(value)

const relativeTime = (value: string | null) => {
  if (!value) return 'No events yet'
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60]
  ]
  const [unit, divisor] = units.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) ?? ['second', 1]
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / divisor), unit)
}

const dateDaysAgo = (days: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

const DetailField = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className='rounded-lg border border-border/60 bg-background/35 p-3'>
    <div className='text-xs uppercase tracking-wide text-secondary-foreground'>{label}</div>
    <div className='mt-1 break-words font-mono text-sm'>{value || 'none'}</div>
  </div>
)

const FilterField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className='grid gap-2'>
    <Label>{label}</Label>
    {children}
  </div>
)

export const ActivityEventsTable = ({
  result,
  filters,
  facets,
  auditRetentionDays
}: {
  result: AuditEventPage
  filters: ActivityFilterValues
  facets: ActivityFacets
  auditRetentionDays: number
}) => {
  const router = useRouter()
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [localFilters, setLocalFilters] = useState<ActivityFilterValues>(filters)
  const [retentionDays, setRetentionDays] = useState(String(auditRetentionDays))
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [retentionOpen, setRetentionOpen] = useState(false)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isPurging, setIsPurging] = useState(false)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  useEffect(() => {
    setRetentionDays(String(auditRetentionDays))
  }, [auditRetentionDays])

  const pushParams = (patch: Partial<ActivityFilterValues> & { page?: number; pageSize?: number }) => {
    const params = compactParams({
      ...filters,
      ...patch,
      page: patch.page ?? 1,
      pageSize: patch.pageSize ?? result.pageSize
    })
    router.push(`/settings/activity${params.size ? `?${params.toString()}` : ''}`)
  }

  const exportHref = useMemo(() => {
    const params = compactParams(filters)
    return `/api/activity/export${params.size ? `?${params.toString()}` : ''}`
  }, [filters])

  const activeFilters = useMemo(() => filterEntries(filters, facets), [facets, filters])
  const hasLocalFilters = Object.values(localFilters).some(Boolean)

  const applyFilters = () => {
    setFilterPanelOpen(false)
    pushParams(localFilters)
  }
  const resetFilters = () => {
    setLocalFilters({})
    router.push('/settings/activity')
  }
  const removeFilter = (key: keyof ActivityFilterValues) => {
    const next = { ...filters, [key]: undefined }
    setLocalFilters(next)
    pushParams(next)
  }
  const setRange = (days: number) => {
    setLocalFilters(current => ({ ...current, from: dateDaysAgo(days), to: undefined }))
  }

  const saveRetention = () => {
    const nextValue = Number(retentionDays)
    startTransition(async () => {
      const saved = await saveAuditRetentionAction(nextValue)
      setRetentionDays(String(saved.auditRetentionDays))
      setRetentionOpen(false)
      toast({
        title: 'Retention updated',
        description: `Activity logs are retained for ${saved.auditRetentionDays} days.`
      })
    })
  }

  const purgeAll = async () => {
    setIsPurging(true)
    try {
      const purgeResult = await purgeAllAuditEventsAction()
      toast({ title: 'Activity logs purged', description: `${purgeResult.purged} events were removed.` })
      setPurgeOpen(false)
    } finally {
      setIsPurging(false)
    }
  }

  return (
    <>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <div className='rounded-xl border border-border/70 bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
          <div className='flex items-center justify-between text-sm text-secondary-foreground'>
            Matching events
            <IconDatabaseExport className='size-4' />
          </div>
          <div className='mt-3 text-3xl font-semibold'>{metricNumber(result.total)}</div>
          <div className='mt-1 text-xs text-secondary-foreground'>Current filtered view</div>
        </div>
        <div className='rounded-xl border border-border/70 bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
          <div className='flex items-center justify-between text-sm text-secondary-foreground'>
            Failures
            <IconShieldCheck className='size-4' />
          </div>
          <div className='mt-3 text-3xl font-semibold'>{metricNumber(result.summary.failure)}</div>
          <div className='mt-1 text-xs text-secondary-foreground'>
            {metricNumber(result.summary.success)} successful
          </div>
        </div>
        <div className='rounded-xl border border-border/70 bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
          <div className='flex items-center justify-between text-sm text-secondary-foreground'>
            Last event
            <IconClock className='size-4' />
          </div>
          <div className='mt-3 text-2xl font-semibold'>{relativeTime(result.summary.lastEventAt)}</div>
          <div className='mt-1 text-xs text-secondary-foreground'>
            {result.summary.lastEventAt ? new Date(result.summary.lastEventAt).toLocaleString() : 'No timestamp'}
          </div>
        </div>
        <div className='rounded-xl border border-border/70 bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
          <div className='flex items-center justify-between text-sm text-secondary-foreground'>
            Retention
            <IconCalendarStats className='size-4' />
          </div>
          <div className='mt-3 text-3xl font-semibold'>{auditRetentionDays} days</div>
          <div className='mt-1 text-xs text-secondary-foreground'>Automatic cleanup window</div>
        </div>
      </div>

      <Section
        title={
          <div>
            <div>Audit trail</div>
            <div className='mt-1 text-sm font-normal text-secondary-foreground'>
              Search, filter, export, and inspect administrative activity.
            </div>
          </div>
        }
        boxed
        contentClassName='gap-4'
      >
        <div className='flex flex-col gap-3 py-3'>
          <div className='grid gap-2 lg:grid-cols-[minmax(16rem,1fr)_auto_auto_auto_auto]'>
            <div className='relative min-w-0'>
              <IconSearch className='pointer-events-none absolute left-3 top-2.5 size-4 text-secondary-foreground' />
              <Input
                value={localFilters.search ?? ''}
                onChange={event => setLocalFilters(current => ({ ...current, search: event.target.value }))}
                onKeyDown={event => {
                  if (event.key === 'Enter') applyFilters()
                }}
                placeholder='Search actor, action, resource, or details'
                className='pl-9'
              />
            </div>
            <Button
              className='max-lg:w-full'
              onClick={applyFilters}
            >
              <IconSearch className='size-4' />
              Search
            </Button>
            <Button
              variant='secondary'
              className='max-lg:w-full'
              onClick={() => setFilterPanelOpen(true)}
            >
              <IconAdjustmentsHorizontal className='size-4' />
              Filters{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}
            </Button>
            <Button
              variant='secondary'
              className='max-lg:w-full'
              asChild
            >
              <a href={exportHref}>
                <IconDownload className='size-4' />
                Export CSV
              </a>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='secondary'
                  className='max-lg:w-full lg:size-9 lg:px-0'
                  aria-label='Activity actions'
                >
                  <IconDotsVertical className='size-4' />
                  <span className='lg:hidden'>More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Activity log</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setRetentionOpen(true)}>
                  <IconCalendarStats className='mr-2 size-4' />
                  Retention settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='text-destructive focus:text-destructive'
                  onClick={() => setPurgeOpen(true)}
                >
                  <IconTrash className='mr-2 size-4' />
                  Purge all logs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className='flex min-h-7 flex-wrap items-center gap-2'>
            <span className='flex items-center gap-1 text-sm text-secondary-foreground'>
              <IconFilter className='size-4' />
              {activeFilters.length === 0 ? 'No filters applied' : `${activeFilters.length} active filters`}
            </span>
            {activeFilters.map(({ key, label, value }) => {
              return (
                <Badge
                  key={`${label}:${value}`}
                  variant='secondary'
                  className='gap-1 py-1 font-normal'
                >
                  <span className='text-secondary-foreground'>{label}</span>
                  {value}
                  <button
                    type='button'
                    className='ml-1 rounded-full hover:text-foreground'
                    onClick={() => removeFilter(key)}
                    aria-label={`Remove ${label} filter`}
                  >
                    <IconX className='size-3' />
                  </button>
                </Badge>
              )
            })}
          </div>
        </div>

        <div className='overflow-hidden rounded-xl border border-border/70 bg-background/25'>
          <Table
            className='table-fixed'
            style={{ minWidth: '78rem' }}
          >
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-64 px-4 py-3 uppercase'>Event</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Actor</TableHead>
                <TableHead className='w-60 px-4 py-3 uppercase'>Target</TableHead>
                <TableHead className='w-40 px-4 py-3 uppercase'>Outcome</TableHead>
                <TableHead className='w-56 px-4 py-3 uppercase'>Time</TableHead>
                <TableHead className='w-28 px-4 py-3 text-right uppercase'>Inspect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.events.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='px-4 py-10'
                  >
                    <div className='mx-auto flex max-w-md flex-col items-center text-center'>
                      <div className='mb-3 rounded-full border border-border/70 bg-card/60 p-3'>
                        <IconSearch className='size-6 text-secondary-foreground' />
                      </div>
                      <div className='font-medium'>No activity found</div>
                      <p className='mt-1 text-sm text-secondary-foreground'>
                        Try clearing filters or widening the date range. New audit events appear here after actions
                        finish.
                      </p>
                      <Button
                        className='mt-4'
                        variant='secondary'
                        onClick={resetFilters}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                result.events.map(event => (
                  <TableRow
                    key={event.id}
                    className='group'
                  >
                    <TableCell className='px-4 py-4 align-top'>
                      <div className='flex items-start gap-3'>
                        <div className='mt-0.5 rounded-lg border border-border/60 bg-secondary/50 p-2'>
                          <IconShieldCheck className='size-4 text-secondary-foreground' />
                        </div>
                        <div className='min-w-0'>
                          <div className='font-medium'>{formatAction(event.action)}</div>
                          <div className='mt-1 flex flex-wrap gap-1'>
                            <Badge variant='outline'>{event.category}</Badge>
                            {event.resourceType && <Badge variant='secondary'>{event.resourceType}</Badge>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-4 align-top'>
                      <div className='font-medium'>{event.actorLabel}</div>
                      <div className='mt-1 font-mono text-xs text-secondary-foreground'>
                        {event.actorUserId ?? 'system'}
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-4 align-top'>
                      <div className='truncate font-medium'>{event.resourceLabel ?? event.resourceId ?? 'none'}</div>
                      <div className='mt-1 truncate font-mono text-xs text-secondary-foreground'>
                        {event.resourceId ?? event.resourceType ?? 'No resource id'}
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-4 align-top'>
                      <Badge variant={outcomeTone(event.outcome)}>{event.outcome}</Badge>
                    </TableCell>
                    <TableCell className='px-4 py-4 align-top'>
                      <div>{new Date(event.createdAt).toLocaleString()}</div>
                      <div className='mt-1 text-xs text-secondary-foreground'>{event.createdAt}</div>
                    </TableCell>
                    <TableCell className='px-4 py-4 text-right align-top'>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={() => setSelectedEvent(event)}
                      >
                        <IconEye className='size-4' />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <PlatformGridPagination
          totalItems={result.total}
          pageIndex={result.page - 1}
          pageSize={result.pageSize}
          onPageIndexChange={pageIndex => pushParams({ page: pageIndex + 1 })}
          onPageSizeChange={pageSize => pushParams({ page: 1, pageSize })}
        />
      </Section>

      <Sheet
        open={Boolean(selectedEvent)}
        onOpenChange={open => {
          if (!open) setSelectedEvent(null)
        }}
      >
        <SheetContent className='w-[min(42rem,calc(100vw-2rem))] overflow-y-auto sm:max-w-none'>
          <SheetHeader>
            <SheetTitle>{selectedEvent ? formatAction(selectedEvent.action) : 'Activity details'}</SheetTitle>
            <SheetDescription>Full audit event metadata for review and troubleshooting.</SheetDescription>
          </SheetHeader>
          {selectedEvent && (
            <div className='mt-6 grid gap-4'>
              <div className='flex flex-wrap gap-2'>
                <Badge variant={outcomeTone(selectedEvent.outcome)}>{selectedEvent.outcome}</Badge>
                <Badge variant='outline'>{selectedEvent.category}</Badge>
                {selectedEvent.resourceType && <Badge variant='secondary'>{selectedEvent.resourceType}</Badge>}
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <DetailField
                  label='Actor'
                  value={`${selectedEvent.actorLabel} (${selectedEvent.actorUserId ?? 'system'})`}
                />
                <DetailField
                  label='Target'
                  value={selectedEvent.resourceLabel ?? selectedEvent.resourceId ?? selectedEvent.resourceType}
                />
                <DetailField
                  label='Created'
                  value={`${new Date(selectedEvent.createdAt).toLocaleString()} / ${selectedEvent.createdAt}`}
                />
                <DetailField
                  label='Source'
                  value={selectedEvent.sourceIp ?? selectedEvent.userAgent}
                />
              </div>
              <div>
                <Label>Details JSON</Label>
                <pre className='mt-2 max-h-[32rem] overflow-auto rounded-lg border border-border/70 bg-background/60 p-4 font-mono text-xs text-secondary-foreground'>
                  {formatDetails(selectedEvent.details)}
                </pre>
              </div>
              {selectedEvent.userAgent && (
                <DetailField
                  label='User agent'
                  value={selectedEvent.userAgent}
                />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={filterPanelOpen}
        onOpenChange={setFilterPanelOpen}
      >
        <SheetContent className='grid h-full w-[min(32rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-none'>
          <SheetHeader className='border-b border-border/70 p-6 pb-5'>
            <SheetTitle>Filter activity</SheetTitle>
            <SheetDescription>
              Build a focused audit view by actor, event type, target, outcome, or time range.
            </SheetDescription>
          </SheetHeader>

          <div className='min-h-0 overflow-y-auto p-6'>
            <div className='grid gap-6'>
              <section className='grid gap-3'>
                <div>
                  <h4 className='font-medium'>Who and what</h4>
                  <p className='text-sm text-secondary-foreground'>Narrow events by the user and affected resource.</p>
                </div>
                <FilterField label='Actor'>
                  <Select
                    value={localFilters.actor || allValue}
                    onValueChange={value =>
                      setLocalFilters(current => ({ ...current, actor: value === allValue ? undefined : value }))
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Actor' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={allValue}>All actors</SelectItem>
                      {facets.actors.map(actor => (
                        <SelectItem
                          key={actor.id}
                          value={actor.id}
                        >
                          {actor.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label='Resource type'>
                  <Select
                    value={localFilters.resourceType || allValue}
                    onValueChange={value =>
                      setLocalFilters(current => ({
                        ...current,
                        resourceType: value === allValue ? undefined : value
                      }))
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Resource' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={allValue}>All resources</SelectItem>
                      {facets.resourceTypes.map(resourceType => (
                        <SelectItem
                          key={resourceType}
                          value={resourceType}
                        >
                          {resourceType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
              </section>

              <section className='grid gap-3 border-t border-border/60 pt-5'>
                <div>
                  <h4 className='font-medium'>Event classification</h4>
                  <p className='text-sm text-secondary-foreground'>
                    Use category, action, and outcome for review workflows.
                  </p>
                </div>
                <FilterField label='Category'>
                  <Select
                    value={localFilters.category || allValue}
                    onValueChange={value =>
                      setLocalFilters(current => ({ ...current, category: value === allValue ? undefined : value }))
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Category' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={allValue}>All categories</SelectItem>
                      {facets.categories.map(category => (
                        <SelectItem
                          key={category}
                          value={category}
                        >
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label='Action'>
                  <Select
                    value={localFilters.action || allValue}
                    onValueChange={value =>
                      setLocalFilters(current => ({ ...current, action: value === allValue ? undefined : value }))
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Action' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={allValue}>All actions</SelectItem>
                      {facets.actions.map(action => (
                        <SelectItem
                          key={action}
                          value={action}
                        >
                          {formatAction(action)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label='Outcome'>
                  <Select
                    value={localFilters.outcome || allValue}
                    onValueChange={value =>
                      setLocalFilters(current => ({ ...current, outcome: value === allValue ? undefined : value }))
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Outcome' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={allValue}>All outcomes</SelectItem>
                      <SelectItem value='success'>Success</SelectItem>
                      <SelectItem value='failure'>Failure</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterField>
              </section>

              <section className='grid gap-3 border-t border-border/60 pt-5'>
                <div>
                  <h4 className='font-medium'>Time range</h4>
                  <p className='text-sm text-secondary-foreground'>Pick a preset or choose exact calendar dates.</p>
                </div>
                <div className='grid grid-cols-3 gap-2'>
                  {[1, 7, 30].map(days => (
                    <Button
                      key={days}
                      type='button'
                      variant='secondary'
                      onClick={() => setRange(days)}
                    >
                      {days === 1 ? '24h' : `${days}d`}
                    </Button>
                  ))}
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <FilterField label='From'>
                    <Input
                      id='activity-from'
                      type='date'
                      value={dateInputValue(localFilters.from)}
                      onChange={event =>
                        setLocalFilters(current => ({ ...current, from: event.target.value || undefined }))
                      }
                    />
                  </FilterField>
                  <FilterField label='To'>
                    <Input
                      id='activity-to'
                      type='date'
                      value={dateInputValue(localFilters.to)}
                      onChange={event =>
                        setLocalFilters(current => ({ ...current, to: event.target.value || undefined }))
                      }
                    />
                  </FilterField>
                </div>
              </section>
            </div>
          </div>

          <div className='flex flex-col-reverse gap-2 border-t border-border/70 bg-background/80 p-4 sm:flex-row sm:justify-end'>
            <Button
              variant='secondary'
              disabled={!hasLocalFilters}
              onClick={resetFilters}
            >
              <IconRefresh className='size-4' />
              Reset
            </Button>
            <Button onClick={applyFilters}>
              <IconFilter className='size-4' />
              Apply filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={retentionOpen}
        onOpenChange={setRetentionOpen}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Activity retention</DialogTitle>
            <DialogDescription>
              Rebroid automatically deletes audit events older than this many days. The default is 30 days.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-2'>
            <Label htmlFor='activity-retention'>Retention days</Label>
            <Input
              id='activity-retention'
              type='number'
              min={1}
              max={3650}
              value={retentionDays}
              onChange={event => setRetentionDays(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={saveRetention}
            >
              {isPending && <IconLoader2 className='size-4 animate-spin' />}
              Save retention
            </Button>
            <DialogClose asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Purge all activity logs?</DialogTitle>
            <DialogDescription>
              This deletes every existing activity event. A new purge event will be recorded after deletion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='destructive'
              disabled={isPurging}
              onClick={() => void purgeAll()}
            >
              {isPurging && <IconLoader2 className='size-4 animate-spin' />}
              Purge all logs
            </Button>
            <DialogClose asChild>
              <Button
                variant='secondary'
                disabled={isPurging}
              >
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
