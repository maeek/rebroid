import type { ReactNode } from 'react'
import { IconArrowUpRight } from '@tabler/icons-react'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { activeWorkflowRunsHref } from '@/shared/model/active-workflow-runs-href'
import { appsInProgressHref, appsNeedingAttentionHref } from '@/shared/model/applications/app-gallery-status'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import { StateView } from '@/shared/ui/state-view'
import type { PlatformOperationItem, PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

const OperationsGroup = ({
  title,
  total,
  empty,
  href,
  linkLabel,
  items = [],
  attention = false
}: {
  title: string
  total?: number
  empty?: string
  href: string
  linkLabel: string
  items?: PlatformOperationItem[]
  attention?: boolean
}) => {
  let count: ReactNode = <Skeleton className='h-5 w-8' />
  if (total !== undefined)
    count = (
      <span
        className={`text-sm font-medium tabular-nums ${attention && total > 0 ? 'text-danger' : 'text-foreground-muted'}`}
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
  else if (total === 0 && empty)
    content = (
      <StateView
        kind='empty'
        artwork='activity'
        title={empty}
      />
    )
  else
    content = (
      <>
        {items.length > 0 ? (
          <ul className='divide-y divide-surface-border/60'>
            {items.map(item => (
              <li
                key={item.id}
                className='grid min-w-0 gap-0.5 py-2 first:pt-0'
              >
                <ResourceLink
                  href={item.href}
                  className='w-fit text-sm font-medium wrap-anywhere'
                >
                  {item.name}
                </ResourceLink>
                <span className='text-xs text-foreground-muted'>{item.impact}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <ResourceLink
          href={href}
          className='inline-flex w-fit items-center gap-1 text-xs font-medium'
        >
          {linkLabel}
          <IconArrowUpRight
            className='size-3.5'
            aria-hidden='true'
          />
        </ResourceLink>
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
          {snapshot?.workflowCatalogAvailable ? (
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
          ) : null}
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
          <div
            className={
              snapshot?.activeRunCount === null
                ? 'grid min-w-0 items-stretch gap-4 lg:grid-cols-2'
                : 'grid min-w-0 items-stretch gap-4 lg:grid-cols-3'
            }
          >
            <OperationsGroup
              title='Apps needing attention'
              total={snapshot?.failedCount}
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
            {snapshot?.activeRunCount !== null ? (
              <OperationsGroup
                title='Active workflow runs'
                total={snapshot?.activeRunCount ?? undefined}
                empty='No active workflow runs.'
                href={activeWorkflowRunsHref}
                linkLabel='View active runs'
                items={snapshot?.activeRuns}
              />
            ) : null}
          </div>
          {snapshot?.collectedAt ? (
            <p className='flex flex-wrap items-center gap-x-1 text-xs text-foreground-muted'>
              Snapshot taken{' '}
              <DateTimeValue
                value={snapshot.collectedAt}
                compact
                showSeconds
              />
            </p>
          ) : null}
        </>
      ) : null}
    </Section>
  )
}
