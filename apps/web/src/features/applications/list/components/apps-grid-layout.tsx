import type { ReactNode } from 'react'

export const AppsGridLayout = ({ children, title }: { children: ReactNode; title: ReactNode }) => (
  <section className='px-2'>
    <div className='mb-3 px-4 max-sm:px-2'>
      <h3 className='text-sm font-medium text-foreground-muted'>{title}</h3>
    </div>
    <div className='grid grid-cols-[repeat(auto-fit,minmax(4.75rem,1fr))] gap-x-3 gap-y-10 px-4 min-[360px]:grid-cols-4 min-[360px]:gap-x-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7'>
      {children}
    </div>
  </section>
)
