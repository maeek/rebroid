import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import { GroupEditPage } from '../../group-edit-page'
import { getGroupDetailPageData } from './page-data.server'

type GroupDetailPageEntryProps = {
  params: Promise<{ id: string }>
}

export default async function GroupDetailPageEntry({ params }: GroupDetailPageEntryProps) {
  const { id } = await params
  const { group } = await getGroupDetailPageData(id)

  if (!group) {
    return (
      <StandardPage className='gap-2'>
        <PageHeader
          section={{ label: 'Security' }}
          trail={[{ label: 'Groups', href: '/security/groups' }]}
          title='Group'
        />
        <PageContent>
          <StateView
            kind='not-found'
            title='Group not found'
            description='The group may have been removed or the link may be stale.'
            actions={[
              {
                label: 'Back to groups',
                href: '/security/groups'
              }
            ]}
          />
        </PageContent>
      </StandardPage>
    )
  }

  return <GroupEditPage group={group} />
}
