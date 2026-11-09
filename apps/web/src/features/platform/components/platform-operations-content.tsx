import type { ReactNode } from 'react'
import { IconArrowUpRight } from '@tabler/icons-react'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { AutomationRunStatusBadge } from '@/shared/ui/automation/automation-run-status-badge'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

const previewLimit = 5

const runTraceHref = (automationId: string, runId: string) =>
  `/automations/${encodeURIComponent(automationId)}/traces?run=${encodeURIComponent(runId)}`

const OperationsGroup = ({
  title,
  total,
  shown,
  empty,
  children,
  attention = false
}: {
  title: string
  total?: number
  shown: number
  empty: string
  children: ReactNode
  attention?: boolean
}) => {
  let count: ReactNode = <Skeleton className='h-8 w-8' />
  if (total !== undefined)
    count = (
      <span
        className={`text-2xl font-medium tabular-nums ${attention && total > 0 ? 'text-danger' : 'text-foreground'}`}
      >
        {total}
      </span>
    )
  let content: ReactNode
  if (total === undefined)
    content = (
      <div
        role='status'
        aria-label={`Loading ${title.toLowerCase()}`}
        className='grid gap-3'
      >
        <Skeleton className='h-4 w-2/3' />
        <Skeleton className='h-3 w-full' />
      </div>
    )
  else if (total === 0) content = <p className='text-sm text-foreground-muted'>{empty}</p>
  else
    content = (
      <>
        <ul className='grid min-w-0 gap-4'>{children}</ul>
        {total > shown ? (
          <p className='text-xs text-foreground-muted'>
            Showing {shown} of {total}
          </p>
        ) : null}
      </>
    )
  return (
    <Section
      surface='panel'
      title={title}
      headingLevel={3}
      headingSpacing='compact'
      contentClassName='gap-3'
      actions={count}
    >
      {content}
    </Section>
  )
}

const AppOperationRow = ({ id, name, detail }: { id: string; name: string; detail: string }) => (
  <li className='grid min-w-0 gap-1'>
    <ResourceLink
      href={`/app/${encodeURIComponent(id)}`}
      className='w-fit max-w-full truncate text-sm font-medium'
      title={name}
    >
      {name}
    </ResourceLink>
    <p
      className='line-clamp-2 break-words text-xs leading-5 text-foreground-muted'
      title={detail}
    >
      {detail}
    </p>
  </li>
)

export const PlatformOperationsContent = ({
  snapshot,
  error = false,
  requestId
}: {
  snapshot: PlatformOperationsSnapshot | null
  error?: boolean
  requestId?: string
}) => {
  const failed = snapshot?.failed.slice(0, previewLimit) ?? []
  const pending = snapshot?.pending.slice(0, previewLimit) ?? []
  const runs = snapshot?.runs.slice(0, previewLimit) ?? []
  return (
    <Section
      surface='plain'
      title='Operations'
      description='Current app health and work in progress.'
      contentClassName='gap-4'
      actions={
        <div className='flex flex-wrap justify-end gap-x-4 gap-y-2 text-sm'>
          <ResourceLink
            href='/apps'
            className='inline-flex items-center gap-1 whitespace-nowrap font-medium'
          >
            All apps{' '}
            <IconArrowUpRight
              className='size-4'
              aria-hidden='true'
            />
          </ResourceLink>
          <ResourceLink
            href='/automations'
            className='inline-flex items-center gap-1 whitespace-nowrap font-medium'
          >
            All workflows{' '}
            <IconArrowUpRight
              className='size-4'
              aria-hidden='true'
            />
          </ResourceLink>
        </div>
      }
      titleClassName='flex-wrap'
    >
      {error ? (
        <Notice
          tone='warning'
          title={snapshot ? 'Operations could not be refreshed' : 'Operations unavailable'}
          description={
            snapshot
              ? 'Showing the last loaded snapshot. Refresh Overview to try again.'
              : 'App health and workflow activity could not be loaded. Refresh Overview to try again.'
          }
        >
          {requestId ? <p className='text-xs [overflow-wrap:anywhere]'>Reference: {requestId}</p> : null}
        </Notice>
      ) : null}
      {snapshot || !error ? (
        <>
          <div className='grid min-w-0 items-stretch gap-4 lg:grid-cols-3'>
            <OperationsGroup
              title='Apps needing attention'
              total={snapshot?.failedCount}
              shown={failed.length}
              empty='No app failures.'
              attention
            >
              {failed.map(app => (
                <AppOperationRow
                  key={app.id}
                  id={app.id}
                  name={app.name}
                  detail={app.description ?? 'Open the app to inspect failure details.'}
                />
              ))}
            </OperationsGroup>
            <OperationsGroup
              title='App operations'
              total={snapshot?.pendingCount}
              shown={pending.length}
              empty='No app operations in progress.'
            >
              {pending.map(app => (
                <AppOperationRow
                  key={app.id}
                  id={app.id}
                  name={app.name}
                  detail={app.title}
                />
              ))}
            </OperationsGroup>
            <OperationsGroup
              title='Active workflow runs'
              total={snapshot?.activeRunCount}
              shown={runs.length}
              empty='No active workflow runs.'
            >
              {runs.map(run => (
                <li
                  key={run.id}
                  className='flex min-w-0 flex-wrap items-center justify-between gap-2'
                >
                  <ResourceLink
                    href={runTraceHref(run.automationId, run.id)}
                    className='text-sm font-medium'
                  >
                    Run {run.id.slice(0, 8)}
                  </ResourceLink>
                  <AutomationRunStatusBadge status={run.status} />
                </li>
              ))}
            </OperationsGroup>
          </div>
          <p className='text-xs text-foreground-muted'>
            Snapshot updates when you refresh. Open a resource for details.
          </p>
        </>
      ) : null}
    </Section>
  )
}
