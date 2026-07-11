import { StandardPage } from '@/shared/ui/page/page-layout'
import { StatusSplash } from '@/shared/ui/status-splash'
import { UserEditPage } from '../../user-edit-page'
import { getUserDetailPageData } from './page-data.server'

type UserDetailPageEntryProps = {
  params: Promise<{ id: string }>
}

export default async function UserDetailPageEntry({ params }: UserDetailPageEntryProps) {
  const { id } = await params
  const { user, groups } = await getUserDetailPageData(id)

  if (!user) {
    return (
      <StandardPage className='gap-2'>
        <section className='px-6 py-16 max-sm:px-4'>
          <StatusSplash
            title='User not found'
            description='The account may have been removed or the link may be stale.'
            tone='danger'
            secondaryAction={{
              label: 'Back to users',
              href: '/security/users'
            }}
          />
        </section>
      </StandardPage>
    )
  }

  return (
    <UserEditPage
      user={user}
      groups={groups}
    />
  )
}
