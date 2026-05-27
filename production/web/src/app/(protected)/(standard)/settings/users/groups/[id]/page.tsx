import { GroupEditPage } from '@/features/settings/users/group-edit-page'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { userService } from '@/server/auth/user'
import { getResourceLimitBoundsAction } from '@/server/orchestrator/diagnostics/actions'

export default async function UserGroupSettingsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [groups, resourceLimits] = await Promise.all([
    userService.listGroups(),
    getResourceLimitBoundsAction().catch(() => null)
  ])
  const group = groups.find(item => item.id === id)

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
              href: '/settings/users/groups'
            }}
          />
        </section>
      </ProtectedStackPageLayout>
    )
  }

  return (
    <GroupEditPage
      group={group}
      resourceLimits={resourceLimits}
    />
  )
}
