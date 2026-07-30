'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { panelSurfaceClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { createDataGridLoadingProps } from '@/shared/ui/data-grid/data-grid-loading-state'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import {
  automationVisualPrimaryClassName,
  automationVisualSecondaryDesktopClassName,
  automationVisualWorkspaceClassName
} from './editor/automation-editor-layout'

const AutomationHeaderSkeleton = ({
  title,
  description,
  trail = []
}: {
  title: string
  description: string
  trail?: Array<{ label: string; href?: string }>
}) => (
  <PageHeader
    section={{ label: 'Automations', href: '/automations' }}
    trail={trail}
    title={title}
    description={description}
  />
)

export const AutomationsListPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <AutomationHeaderSkeleton
      title='Automations'
      description='Create, run, and monitor reusable Android workflows.'
    />
    <PageContent className='pt-2'>
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <Skeleton className='h-10 w-full max-w-md' />
        <Skeleton className='h-10 w-28' />
        <Skeleton className='h-10 w-28' />
      </div>
      <DataGrid
        {...createDataGridLoadingProps({
          columns: [
            { headerWidth: 'w-20', cellWidth: 'w-48', kind: 'stacked' },
            { headerWidth: 'w-12', cellWidth: 'w-36' },
            { headerWidth: 'w-16', kind: 'badge' },
            { headerWidth: 'w-20', cellWidth: 'w-28' },
            { headerWidth: 'w-16', cellWidth: 'w-24' }
          ],
          rows: 6,
          selectable: false,
          rowMenu: false
        })}
      />
    </PageContent>
  </StandardPage>
)

export const AutomationTriggersPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <AutomationHeaderSkeleton
      title='Triggers'
      description='Schedule or externally trigger automation runs.'
    />
    <PageContent className='pt-2'>
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <Skeleton className='h-10 w-full max-w-md' />
        <Skeleton className='h-10 w-28' />
        <Skeleton className='h-10 w-28' />
        <Skeleton className='h-10 w-28' />
      </div>
      <DataGrid
        {...createDataGridLoadingProps({
          columns: [
            { headerWidth: 'w-16', cellWidth: 'w-44', kind: 'stacked' },
            { headerWidth: 'w-20', cellWidth: 'w-40' },
            { headerWidth: 'w-16', cellWidth: 'w-36' },
            { headerWidth: 'w-14', kind: 'badge' },
            { headerWidth: 'w-20', cellWidth: 'w-24' }
          ],
          rows: 6,
          selectable: false,
          rowMenu: false
        })}
      />
    </PageContent>
  </StandardPage>
)

export const AutomationEditorPageSkeleton = () => (
  <StandardPage className='gap-0'>
    <AutomationHeaderSkeleton
      title='Automation editor'
      description='Define workflow metadata, steps, targets, and execution policy.'
    />
    <PageContent className='grid gap-6 pt-2'>
      <div className={automationVisualWorkspaceClassName}>
        <div className={automationVisualPrimaryClassName}>
          <section className='flex w-full flex-col gap-4 pb-4'>
            <div className='flex h-8 items-center justify-between gap-3'>
              <Skeleton className='h-7 w-24' />
            </div>
            <div className='grid gap-4'>
              <div className='grid gap-2'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-10 w-full' />
              </div>
              <div className='grid gap-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-24 w-full' />
              </div>
              <div className='grid gap-2'>
                <Skeleton className='h-4 w-14' />
                <Skeleton className='h-10 w-full rounded-control' />
              </div>
            </div>
          </section>

          <section className='grid min-w-0 content-start gap-3'>
            <div className='flex h-8 items-center justify-between gap-3'>
              <Skeleton className='h-7 w-20' />
            </div>
            <div className='grid min-w-0 gap-2 rounded-control'>
              <div className='relative grid min-h-10 gap-2'>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    data-automation-step-item='true'
                    className='grid min-h-14 rounded-control border border-surface-border/60 bg-surface-panel/45'
                  >
                    <div className='grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5'>
                      <Skeleton className='size-8 rounded-control' />
                      <div className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-1 py-1'>
                        <Skeleton className='size-8 rounded-control' />
                        <span className='grid min-w-0 gap-1'>
                          <Skeleton className='h-4 w-44 max-w-full' />
                          <Skeleton className='h-3 w-64 max-w-full' />
                        </span>
                      </div>
                      <div className='flex items-center gap-0.5'>
                        <Skeleton className='size-8 rounded-control' />
                        <Skeleton className='size-8 rounded-control' />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className='h-10 w-full rounded-control' />
            </div>
          </section>
        </div>

        <div className={cn('hidden', automationVisualSecondaryDesktopClassName)}>
          <aside className='hidden min-w-0 xl:block'>
            <div className={cn('overflow-hidden rounded-panel', panelSurfaceClassName)}>
              <div className='grid max-h-[calc(100dvh-7rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)]'>
                <div className='flex min-h-14 items-center justify-between gap-3 border-b border-surface-border/60 px-4 py-3'>
                  <div className='grid min-w-0 gap-1'>
                    <Skeleton className='h-5 w-36' />
                    <Skeleton className='h-3 w-48' />
                  </div>
                  <Skeleton className='size-9 rounded-control' />
                </div>
                <div className='grid gap-4 px-4 py-4'>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className='grid gap-2'
                    >
                      <Skeleton className='h-4 w-24' />
                      <Skeleton className='h-10 w-full' />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageContent>
  </StandardPage>
)

export const AutomationTracesPageSkeleton = () => (
  <StandardPage className='gap-0'>
    <AutomationHeaderSkeleton
      trail={[{ label: 'Automation' }]}
      title='Run traces'
      description='Inspect automation execution history and step evidence.'
    />
    <PageContent className='grid gap-6 pt-2'>
      <div className='grid gap-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <Skeleton className='h-10 w-full max-w-md' />
          <Skeleton className='h-10 w-28' />
        </div>
        <DataGrid
          {...createDataGridLoadingProps({
            columns: [
              { headerWidth: 'w-16', cellWidth: 'w-32' },
              { headerWidth: 'w-20', cellWidth: 'w-44' },
              { headerWidth: 'w-16', kind: 'badge' },
              { headerWidth: 'w-20', cellWidth: 'w-24' },
              { headerWidth: 'w-20', cellWidth: 'w-36' }
            ],
            rows: 6,
            selectable: false,
            rowMenu: false
          })}
        />
      </div>
    </PageContent>
  </StandardPage>
)
