'use client'

import { useMemo, useState } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlatformGridPagination } from '@/features/orchestrator/components/platform-grid-pagination'
import type { AuditEvent } from '@/server/storage/database'

type ActivityEvent = AuditEvent & { actorLabel: string }

const formatAction = (action: string) =>
  action
    .split('.')
    .map(value => value.charAt(0).toUpperCase() + value.slice(1))
    .join(' ')

const formatDetails = (details: Record<string, unknown>) =>
  Object.keys(details).length === 0 ? 'none' : JSON.stringify(details)

export const ActivityEventsTable = ({ events }: { events: ActivityEvent[] }) => {
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return events
    return events.filter(event =>
      [event.action, event.actorLabel, event.subject, formatDetails(event.details)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [events, search])
  const pageCount = Math.max(Math.ceil(filteredEvents.length / pageSize), 1)
  const normalizedPageIndex = Math.min(pageIndex, pageCount - 1)
  const pageEvents = filteredEvents.slice(normalizedPageIndex * pageSize, (normalizedPageIndex + 1) * pageSize)

  return (
    <Section
      title='Recent activity'
      titleClassName='mb-4'
      boxed
      contentClassName='gap-4'
    >
      <div className='relative max-w-md'>
        <IconSearch className='pointer-events-none absolute left-3 top-2.5 size-4 text-secondary-foreground' />
        <Input
          value={search}
          onChange={event => {
            setSearch(event.target.value)
            setPageIndex(0)
          }}
          placeholder='Search activity'
          className='pl-9'
        />
      </div>
      <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
        <Table
          className='table-fixed'
          style={{ minWidth: '72rem' }}
        >
          <TableHeader className='bg-background/45'>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='w-48 px-4 py-3 uppercase'>Time</TableHead>
              <TableHead className='w-52 px-4 py-3 uppercase'>Action</TableHead>
              <TableHead className='w-44 px-4 py-3 uppercase'>Actor</TableHead>
              <TableHead className='w-56 px-4 py-3 uppercase'>Subject</TableHead>
              <TableHead className='px-4 py-3 uppercase'>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageEvents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='px-4 py-4 text-sm text-secondary-foreground'
                >
                  No activity events match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              pageEvents.map(event => (
                <TableRow key={event.id}>
                  <TableCell className='px-4 py-3 align-top text-secondary-foreground'>
                    {new Date(event.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className='px-4 py-3 align-top'>
                    <Badge variant='secondary'>{formatAction(event.action)}</Badge>
                  </TableCell>
                  <TableCell className='px-4 py-3 align-top text-secondary-foreground'>{event.actorLabel}</TableCell>
                  <TableCell className='px-4 py-3 align-top text-secondary-foreground'>
                    {event.subject ?? 'none'}
                  </TableCell>
                  <TableCell className='px-4 py-3 align-top font-mono text-xs text-secondary-foreground'>
                    <div className='max-w-[32rem] break-words'>{formatDetails(event.details)}</div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <PlatformGridPagination
        totalItems={filteredEvents.length}
        pageIndex={normalizedPageIndex}
        pageSize={pageSize}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={setPageSize}
      />
    </Section>
  )
}
