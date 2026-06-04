'use client'

import { IconActivityHeartbeat, IconDotsVertical } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Automation } from '@/server/orchestrator/automations/types'

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

export function AutomationsTable({ automations }: { automations: Automation[] }) {
  const router = useRouter()

  return (
    <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
      <div className='overflow-x-auto'>
        <Table
          className='table-fixed'
          style={{ minWidth: '56rem' }}
        >
          <TableHeader className='bg-background/45'>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='w-md px-4 py-3 uppercase'>Workflow</TableHead>
              <TableHead className='w-28 px-4 py-3 uppercase'>Steps</TableHead>
              <TableHead className='w-44 px-4 py-3 uppercase'>Last run</TableHead>
              <TableHead className='w-32 px-4 py-3 uppercase'>Status</TableHead>
              <TableHead className='w-16 px-4 py-3 text-right uppercase'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.map(automation => {
              const stepCount = automation.definition.spec.steps.length
              const href = `/automations/${automation.id}`

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
                  <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                    {stepCount} {stepCount === 1 ? 'step' : 'steps'}
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
                            onKeyDown={event => event.stopPropagation()}
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
                            onSelect={() => router.push(`${href}?view=traces`)}
                          >
                            <IconActivityHeartbeat className='size-4' />
                            Traces
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
