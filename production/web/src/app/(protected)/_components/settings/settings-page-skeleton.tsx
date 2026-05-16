import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { Skeleton } from '@/components/ui/skeleton'

export const SettingsPageSkeleton = ({
  title,
  sectionTitle,
  rows
}: {
  title: string
  sectionTitle: string
  rows: number
}) => {
  return (
    <ProtectedStackPageLayout mainClassName='h-full justify-between gap-2'>
      <section className='py-4 px-6 max-sm:px-4 flex items-center justify-between gap-3 shrink-0 bg-background'>
        <div className='flex flex-col gap-2'>
          <span className='sr-only'>{title}</span>
          <Skeleton className='h-9 w-40 max-sm:h-7 max-sm:w-28' />
        </div>
        <div className='flex gap-2'>
          <Skeleton className='h-10 w-24' />
          <Skeleton className='h-10 w-24' />
        </div>
      </section>
      <section className='px-6 max-sm:px-4 w-full flex flex-col gap-6 shrink flex-wrap pb-16'>
        <div className='flex flex-col w-full rounded-lg py-4'>
          <Skeleton className='h-5 w-24 mb-6' />
          <span className='sr-only'>{sectionTitle}</span>
          <div className='flex flex-col gap-6'>
            {Array.from({ length: rows }).map((_, index) => (
              <div
                key={index}
                className='flex flex-col gap-3 w-full'
              >
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-3 w-full max-w-2xl opacity-70' />
                <Skeleton className={index === rows - 1 ? 'h-6 w-12 rounded-full' : 'h-10 w-full'} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </ProtectedStackPageLayout>
  )
}
