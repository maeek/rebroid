import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { ActivityEventsTable } from '@/features/settings/activity/activity-events-table'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { listAuditEvents } from '@/server/storage/database'

export default async function ActivitySettingsPage() {
  await requireAdmin()
  const events = listAuditEvents()
  const users = await userService.listUsers()
  const userLabels = new Map(users.map(user => [user.id, user.name || user.username]))

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Activity'
        description='Review recent administrative and application operations.'
        includeOrchestratorBreadcrumb={false}
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <ActivityEventsTable
          events={events.map(event => ({
            ...event,
            actorLabel: event.actorUserId ? (userLabels.get(event.actorUserId) ?? event.actorUserId) : 'system'
          }))}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
