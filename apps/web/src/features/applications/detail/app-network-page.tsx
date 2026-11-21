'use client'

import { Badge } from '@/components/ui/badge'
import { Notice } from '@/components/ui/notice'
import { AppManageNetworkPolicySettings } from '@/features/applications/manage/app-manage-network-policy-settings'
import { mergeAppConfiguration } from '@/features/applications/manage/use-app-manage-draft'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { hasPermission } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { AppResourceLayout } from './app-resource-layout'
import { AppResourceNavigation } from './app-resource-navigation'
import { useApplicationViewerApp } from './application-viewer-context'

export const AppNetworkPage = () => {
  const { app, permissions, isForeignOwnedApp, canViewAuditActivity, setApp } = useApplicationViewerApp()
  const { isFeatureEnabled, isLoading, manifest } = useFeatureFlags()
  const firewallEnabled = isFeatureEnabled('feature.firewall')
  const canConfigureEgress = hasPermission(permissions, 'applications:configure-egress')
  let unavailableDescription = 'The Firewall feature is turned off.'
  if (!canConfigureEgress) unavailableDescription = 'You need permission to configure app network access.'
  else if (!manifest) unavailableDescription = 'Firewall availability could not be checked.'

  let settings = (
    <Notice
      title='Network access settings unavailable'
      description={unavailableDescription}
    />
  )
  if (canConfigureEgress) {
    if (isLoading) settings = <Notice loading />
    else if (firewallEnabled) {
      settings = (
        <AppManageNetworkPolicySettings
          key={app.id}
          app={app}
          canUseInternet={hasPermission(permissions, 'applications:use-internet')}
          onUpdated={next => setApp(current => mergeAppConfiguration(next, current))}
        />
      )
    }
  }

  return (
    <EditorPage>
      <AppResourceLayout
        heading={
          <AppViewerHeading
            app={app}
            showStatusBadge
          />
        }
        navigation={
          <AppResourceNavigation
            appId={app.id}
            active='network'
            permissions={permissions}
            isForeignOwnedApp={isForeignOwnedApp}
            canViewAuditActivity={canViewAuditActivity}
          />
        }
        status={
          isForeignOwnedApp ? (
            <Badge variant='outline'>Owner: {app.ownerDisplayName ?? app.ownerUserId ?? 'Unknown'}</Badge>
          ) : null
        }
      >
        {settings}
      </AppResourceLayout>
    </EditorPage>
  )
}
