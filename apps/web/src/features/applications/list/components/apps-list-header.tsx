import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/shared/ui/page/page-header'

export const AppsListHeader = ({ canCreate = false, loading = false }: { canCreate?: boolean; loading?: boolean }) => {
  let actions = null
  if (loading) {
    actions = (
      <Button disabled>
        <IconPlus className='size-4' /> Create app
      </Button>
    )
  } else if (canCreate) {
    actions = (
      <Button asChild>
        <Link href='/apps/create'>
          <IconPlus className='size-4' /> Create app
        </Link>
      </Button>
    )
  }
  return (
    <PageHeader
      section={{ label: 'Apps' }}
      breadcrumbLabel='All apps'
      desktopOnlyBreadcrumbRow
      title='Apps'
      actions={actions}
    />
  )
}
