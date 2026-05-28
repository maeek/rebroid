import { UserEditPage } from '@/features/settings/users/user-edit-page'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { StatusSplash } from '@/features/shell/components/status-splash'
import { userService } from '@/server/auth/user'

export default async function UserSettingsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, groups] = await Promise.all([userService.getUserById(id), userService.listGroups()])

  if (!user) {
    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <section className='px-6 py-16 max-sm:px-4'>
          <StatusSplash
            title='User not found'
            description='The account may have been removed or the link may be stale.'
            tone='danger'
            secondaryAction={{
              label: 'Back to users',
              href: '/settings/users'
            }}
          />
        </section>
      </ProtectedStackPageLayout>
    )
  }

  return (
    <UserEditPage
      user={user}
      groups={groups}
    />
  )
}
