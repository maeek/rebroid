import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageBreadcrumbsSkeleton } from '@/shared/ui/page/page-breadcrumbs-skeleton'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'

const SettingsHeaderSkeleton = ({ title, variant }: { title: string; variant: 'standard' | 'orchestrator' }) => (
  <section className='flex shrink-0 items-center justify-between gap-3 px-6 py-4 max-sm:flex-col max-sm:items-start max-sm:px-4'>
    <div className='flex flex-col gap-2'>
      <span className='sr-only'>{title}</span>
      <PageBreadcrumbsSkeleton
        className='pt-0'
        itemWidths={variant === 'orchestrator' ? ['w-24', 'w-24'] : ['w-16', 'w-24']}
      />
      <Skeleton className='h-9 w-40 pt-4 max-sm:h-7 max-sm:w-28' />
      {variant === 'orchestrator' ? <Skeleton className='h-4 w-full max-w-3xl opacity-70' /> : null}
    </div>
    <div className='flex gap-2 max-sm:w-full'>
      <Skeleton className='h-10 w-24 max-sm:flex-1' />
      <Skeleton className='h-10 w-24 max-sm:flex-1' />
    </div>
  </section>
)

const SettingRowSkeleton = ({
  controlClassName = 'h-10 w-full',
  description = true
}: {
  controlClassName?: string
  description?: boolean
}) => (
  <div className='flex w-full flex-col items-start gap-3'>
    <Skeleton className='h-4 w-40' />
    {description ? <Skeleton className='h-3 w-full max-w-2xl opacity-70' /> : null}
    <Skeleton className={controlClassName} />
  </div>
)

const PlainSectionSkeleton = ({
  titleWidth,
  children,
  contentClassName = 'gap-6'
}: {
  titleWidth: string
  children: ReactNode
  contentClassName?: string
}) => (
  <section className='flex w-full flex-col rounded-xl p-0'>
    <div className='flex items-center justify-between pb-4'>
      <Skeleton className={`h-5 ${titleWidth}`} />
    </div>
    <div className={`flex flex-col ${contentClassName}`}>{children}</div>
  </section>
)

export const SettingsPageSkeleton = ({
  title,
  sectionTitle,
  rows,
  variant = 'standard'
}: {
  title: string
  sectionTitle: string
  rows: number
  variant?: 'standard' | 'orchestrator'
}) => {
  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <SettingsHeaderSkeleton
        title={title}
        variant={variant}
      />
      {variant === 'orchestrator' ? (
        <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
          <div className='grid w-full gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]'>
            <div className='flex min-w-0 flex-col gap-6'>
              <PlainSectionSkeleton
                titleWidth='w-36'
                contentClassName='gap-6'
              >
                {Array.from({ length: rows + 1 }).map((_, index) => (
                  <SettingRowSkeleton key={index} />
                ))}
              </PlainSectionSkeleton>
            </div>
            <PlainSectionSkeleton
              titleWidth='w-32'
              contentClassName='gap-4'
            >
              <Skeleton className='h-4 w-full opacity-70' />
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className='flex w-full items-center justify-between gap-4 rounded-lg border border-surface-border/55 bg-surface-band/50 p-3.5 max-sm:flex-col max-sm:items-stretch'
                >
                  <div className='flex min-w-0 items-start gap-3'>
                    <Skeleton className='size-9 rounded-md' />
                    <div className='flex min-w-0 flex-col gap-2'>
                      <Skeleton className='h-4 w-36' />
                      <Skeleton className='h-3 w-56 max-w-full opacity-70' />
                    </div>
                  </div>
                  <Skeleton className='h-10 w-20 shrink-0 max-sm:w-full' />
                </div>
              ))}
              <div className='rounded-md bg-destructive/10 p-4'>
                <div className='flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch'>
                  <div className='flex min-w-0 items-start gap-3'>
                    <Skeleton className='size-9 rounded-md' />
                    <div className='flex flex-col gap-2'>
                      <Skeleton className='h-4 w-28' />
                      <Skeleton className='h-3 w-56 max-w-full opacity-70' />
                    </div>
                  </div>
                  <Skeleton className='h-10 w-28 shrink-0 max-sm:w-full' />
                </div>
              </div>
            </PlainSectionSkeleton>
          </div>
        </section>
      ) : (
        <section className='flex w-full flex-col gap-10 px-6 pb-16 max-sm:px-4'>
          <PlainSectionSkeleton titleWidth='w-40'>
            {Array.from({ length: rows }).map((_, index) => (
              <SettingRowSkeleton
                key={index}
                controlClassName={index === rows - 1 ? 'h-6 w-12 rounded-full' : 'h-10 w-full'}
              />
            ))}
          </PlainSectionSkeleton>
          <PlainSectionSkeleton titleWidth='w-36'>
            <div className='grid gap-4 md:grid-cols-3'>
              {Array.from({ length: 5 }).map((_, index) => (
                <SettingRowSkeleton
                  key={index}
                  controlClassName={index > 0 && index < 4 ? 'h-16 w-full' : 'h-10 w-full'}
                />
              ))}
            </div>
            <SettingRowSkeleton controlClassName='h-6 w-12 rounded-full' />
            <SettingRowSkeleton controlClassName='h-6 w-12 rounded-full' />
          </PlainSectionSkeleton>
        </section>
      )}
      <span className='sr-only'>{sectionTitle}</span>
    </ProtectedStackPageLayout>
  )
}
