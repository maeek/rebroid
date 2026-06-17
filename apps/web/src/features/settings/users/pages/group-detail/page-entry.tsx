import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { StatusSplash } from '@/shared/ui/status-splash'
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
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <section className='px-6 py-16 max-sm:px-4'>
          <StatusSplash
            title='Group not found'
            description='The group may have been removed or the link may be stale.'
            tone='danger'
            secondaryAction={{
              label: 'Back to groups',
              href: '/security/groups'
            }}
          />
        </section>
      </ProtectedStackPageLayout>
    )
  }

  return <GroupEditPage group={group} />
}
