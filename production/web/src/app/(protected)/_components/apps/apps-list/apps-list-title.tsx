import { PageBreadcrumbs } from '@/app/(protected)/_components/page-breadcrumbs'

export const AppsListTitle = () => {
  return (
    <div className='flex flex-col gap-6'>
      <PageBreadcrumbs
        className='pt-0'
        items={[{ label: 'Apps' }]}
      />
      <h2 className='text-3xl max-sm:text-xl font-medium shrink-0'>Apps</h2>
    </div>
  )
}
