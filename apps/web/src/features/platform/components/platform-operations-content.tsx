import type { ReactNode } from 'react'
import { IconArrowUpRight } from '@tabler/icons-react'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { activeWorkflowRunsHref } from '@/shared/model/active-workflow-runs-href'
import { appsInProgressHref, appsNeedingAttentionHref } from '@/shared/model/applications/app-gallery-status'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

const OperationsGroup = ({
  title,
  total,
  empty,
  href,
  linkLabel,
  attention = false
}: {
  title: string
  total?: number
  empty: string
  href: string
  linkLabel: string
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
      >
        <Skeleton className='h-5 w-36' />
      </div>
    )
  else if (total === 0) content = <p className='text-sm text-foreground-muted'>{empty}</p>
  else
    content = (
      <ResourceLink
        href={href}
        className='inline-flex w-fit items-center gap-1 text-sm font-medium'
      >
        {linkLabel}
        <IconArrowUpRight
          className='size-4'
          aria-hidden='true'
        />
      </ResourceLink>
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

export const PlatformOperationsContent = ({
  snapshot,
  error = false,
  requestId
}: {
  snapshot: PlatformOperationsSnapshot | null
  error?: boolean
  requestId?: string
}) => {
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
              empty='No app failures.'
              href={appsNeedingAttentionHref}
              linkLabel='View affected apps'
              attention
            />
            <OperationsGroup
              title='App operations'
              total={snapshot?.pendingCount}
              empty='No app operations in progress.'
              href={appsInProgressHref}
              linkLabel='View apps in progress'
            />
            <OperationsGroup
              title='Active workflow runs'
              total={snapshot?.activeRunCount}
              empty='No active workflow runs.'
              href={activeWorkflowRunsHref}
              linkLabel='View active runs'
            />
          </div>
          <p className='text-xs text-foreground-muted'>
            Snapshot updates when you refresh. Open a resource for details.
          </p>
        </>
      ) : null}
    </Section>
  )
}
