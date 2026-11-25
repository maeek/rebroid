import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { compactPageActionClassName, PageHeader } from '@/shared/ui/page/page-header'

export const AppsListHeader = ({ canCreate = false, loading = false }: { canCreate?: boolean; loading?: boolean }) => {
  let actions = null
  if (loading) {
    actions = (
      <Button
        className={compactPageActionClassName}
        disabled
      >
        <IconPlus
          aria-hidden
          className='size-4'
        />{' '}
        Create app
      </Button>
    )
  } else if (canCreate) {
    actions = (
      <Button
        asChild
        className={compactPageActionClassName}
      >
        <Link href='/apps/new'>
          <IconPlus
            aria-hidden
            className='size-4'
          />{' '}
          Create app
        </Link>
      </Button>
    )
  }
  return (
    <PageHeader
      section={{ label: 'Apps' }}
      breadcrumbLabel='All apps'
      className='max-sm:pt-(--page-header-top-inset)'
      desktopOnlyBreadcrumbRow
      title='Apps'
      actions={actions}
    />
  )
}
