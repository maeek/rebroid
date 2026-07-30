import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'

const SectionSkeleton = ({ children, titleWidth }: { children: ReactNode; titleWidth: string }) => (
  <section className='flex w-full flex-col rounded-panel p-0'>
    <div className='flex items-center justify-between pb-4'>
      <Skeleton className={`h-5 ${titleWidth}`} />
    </div>
    <div className='flex flex-col gap-6'>{children}</div>
  </section>
)

const SettingSkeleton = ({ controlClassName = 'h-10 w-full' }: { controlClassName?: string }) => (
  <div className='flex w-full flex-col items-start gap-3'>
    <Skeleton className='h-4 w-40' />
    <Skeleton className='h-3 w-full max-w-2xl opacity-70' />
    <Skeleton className={controlClassName} />
  </div>
)

export const PreferencesGeneralPageSkeleton = () => (
  <StandardPage className='gap-2'>
    <PageHeader
      section={{ label: 'Preferences' }}
      title='General'
      description='Customize your interface, theme, and local display preferences.'
    />
    <section className='flex w-full flex-col gap-10 px-6 pb-16 max-sm:px-4'>
      <SectionSkeleton titleWidth='w-28'>
        <div className='flex flex-wrap gap-2'>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className='size-9 rounded-full'
            />
          ))}
        </div>
      </SectionSkeleton>
      <SectionSkeleton titleWidth='w-40'>
        <SettingSkeleton controlClassName='h-16 w-full' />
      </SectionSkeleton>
      <SectionSkeleton titleWidth='w-36'>
        <div className='grid gap-4 md:grid-cols-3'>
          <SettingSkeleton />
          <SettingSkeleton controlClassName='h-16 w-full' />
          <SettingSkeleton controlClassName='h-16 w-full' />
          <SettingSkeleton controlClassName='h-16 w-full' />
          <SettingSkeleton />
        </div>
        <SettingSkeleton controlClassName='h-6 w-12 rounded-full' />
        <SettingSkeleton controlClassName='h-6 w-12 rounded-full' />
      </SectionSkeleton>
    </section>
  </StandardPage>
)
