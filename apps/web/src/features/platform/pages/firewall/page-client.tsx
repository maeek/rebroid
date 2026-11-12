'use client'

import { Notice } from '@/components/ui/notice'
import { ServiceSettingsPage } from '@/features/platform/services/service-settings-page'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { FirewallSettings } from './sections/firewall-settings'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'
import type { OptionalServiceUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const FirewallPageClient = ({
  initialHealth,
  initialSettings,
  containerId,
  initialApplications,
  requestId,
  policyFailure,
  loading = false
}: {
  initialHealth?: ServiceHealth
  initialSettings?: OptionalServiceUiSettings
  containerId?: string
  initialApplications?: AndroidApplication[]
  requestId?: string
  policyFailure?: { requestId?: string }
  loading?: boolean
}) => {
  const { isFeatureEnabled } = useFeatureFlags()
  const firewallEnabled = isFeatureEnabled('feature.firewall')

  return (
    <ServiceSettingsPage
      serviceId='firewall'
      initialHealth={initialHealth}
      initialSettings={initialSettings}
      containerId={containerId}
      requestId={requestId}
      loading={loading}
    >
      {loading || (firewallEnabled && initialApplications) ? (
        <FirewallSettings
          initialApplications={initialApplications ?? []}
          loading={loading}
        />
      ) : null}
      {policyFailure ? (
        <Notice
          tone='warning'
          title='Network policies unavailable'
          description='Refresh to load the application policies.'
        >
          {policyFailure.requestId ? (
            <p className='text-xs text-foreground-muted'>Reference: {policyFailure.requestId}</p>
          ) : null}
        </Notice>
      ) : null}
    </ServiceSettingsPage>
  )
}
