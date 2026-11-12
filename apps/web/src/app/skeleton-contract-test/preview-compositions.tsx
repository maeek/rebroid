'use client'

import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { ConsoleDefaultsPageClient } from '@/features/platform/pages/console-defaults/page-client'
import { ConsoleDefaultsPageSkeleton } from '@/features/platform/pages/console-defaults/page-skeleton'
import { ActivityEventsTable } from '@/features/settings/activity/activity-events-table'
import { ActivityPageLayout } from '@/features/settings/activity/activity-page-layout'
import { previewActivityProps } from '@/features/settings/activity/activity-preview-data'
import { GeneralSettingsForm } from '@/features/settings/general/general-settings-form'
import { PreferencesGeneralPageSkeleton } from '@/features/settings/general/pages/preferences-general/preferences-general-page-skeleton'
import { PreferencesSecurityPageClient } from '@/features/settings/security/pages/preferences-security/page-client'
import { PreferencesSecurityPageSkeleton } from '@/features/settings/security/pages/preferences-security/page-skeleton'
import { SystemResourceCharts } from '@/features/settings/system/system-resource-charts'
import { previewUsers } from '@/features/settings/users/users-preview-data'
import { UsersSettings } from '@/features/settings/users/users-settings'
import { defaultOrchestratorUiSettings, pickGeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const UsersListPreview = () => (
  <UsersSettings
    initialUsers={previewUsers}
    initialGroups={[]}
    initialPasswordMinimumLength={8}
  />
)

export const GeneralSettingsPreview = ({ loading = false }: { loading?: boolean }) =>
  loading ? (
    <PreferencesGeneralPageSkeleton />
  ) : (
    <GeneralSettingsForm user={{ name: 'Preview operator', avatarDataUrl: null, accentColor: 'blue' }} />
  )

export const SecuritySettingsPreview = ({ loading = false }: { loading?: boolean }) =>
  loading ? <PreferencesSecurityPageSkeleton /> : <PreferencesSecurityPageClient mfaEnabled={false} />

export const ConsoleDefaultsPreview = ({ loading = false }: { loading?: boolean }) =>
  loading ? (
    <ConsoleDefaultsPageSkeleton />
  ) : (
    <ConsoleDefaultsPageClient initialSettings={pickGeneralUiSettings(defaultOrchestratorUiSettings)} />
  )

export const AppActivityPreview = () => (
  <ActivityEventsTable
    application={{ id: previewApp.id, name: previewApp.name }}
    auditRetentionDays={30}
    facets={{ actors: [], categories: [], actions: [], resourceTypes: [] }}
    filters={{ resourceType: 'application', resourceId: previewApp.id }}
    sorting={[{ id: 'createdAt', desc: true }]}
    result={{
      total: 1,
      page: 1,
      pageSize: 20,
      summary: { success: 0, failure: 1, lastEventAt: '2026-11-07T10:00:00Z' },
      events: [
        {
          id: 1,
          actorUserId: 'preview-user',
          actorLabel: 'Operator',
          action: 'application.start',
          category: 'applications',
          resourceType: 'application',
          resourceId: previewApp.id,
          resourceLabel: previewApp.name,
          outcome: 'failure',
          details: { reason: 'Android boot timed out' },
          sourceIp: null,
          userAgent: null,
          createdAt: '2026-11-07T10:00:00Z'
        }
      ]
    }}
  />
)

export const ResourceChartsPreview = ({ loading }: { loading: boolean }) => (
  <SystemResourceCharts
    stats={{
      totalMemoryBytes: 24 * 1024 ** 3,
      freeMemoryBytes: 1024 ** 3,
      cpuUsagePercentLast50Entrires: [
        ['2026-11-07T12:00:00Z', 20],
        ['2026-11-07T12:00:05Z', 40]
      ]
    }}
    loading={loading}
  />
)

export const AuditLogPreview = () => (
  <ActivityPageLayout>
    <ActivityEventsTable {...previewActivityProps} />
  </ActivityPageLayout>
)
