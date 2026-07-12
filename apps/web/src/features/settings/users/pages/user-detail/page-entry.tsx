import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
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
        <PageHeader
          section={{ label: 'Security' }}
          trail={[{ label: 'Users', href: '/security/users' }]}
          title='User'
        />
        <PageContent>
          <StateView
            kind='not-found'
            title='User not found'
            description='The account may have been removed or the link may be stale.'
            actions={[
              {
                label: 'Back to users',
                href: '/security/users'
              }
            ]}
          />
        </PageContent>
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
