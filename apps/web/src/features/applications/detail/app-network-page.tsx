'use client'

import { Badge } from '@/components/ui/badge'
import { Notice } from '@/components/ui/notice'
import { AppManageNetworkPolicySettings } from '@/features/applications/manage/app-manage-network-policy-settings'
import { mergeAppPreservingDraftAssets } from '@/features/applications/manage/use-app-manage-draft'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { hasPermission } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { AppResourceLayout } from './app-resource-layout'
import { AppResourceNavigation } from './app-resource-navigation'
import { useApplicationViewerApp } from './application-viewer-context'

export const AppNetworkPage = () => {
  const { app, permissions, isForeignOwnedApp, canViewAuditActivity, setApp } = useApplicationViewerApp()
  const { isFeatureEnabled } = useFeatureFlags()
  const firewallEnabled = isFeatureEnabled('feature.firewall')
  const canConfigureEgress = hasPermission(permissions, 'applications:configure-egress')

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
        {firewallEnabled && canConfigureEgress ? (
          <AppManageNetworkPolicySettings
            key={app.id}
            app={app}
            canUseInternet={hasPermission(permissions, 'applications:use-internet')}
            onUpdated={next => setApp(current => mergeAppPreservingDraftAssets(next, current))}
          />
        ) : (
          <Notice
            title='Network access settings unavailable'
            description={
              firewallEnabled
                ? 'You need permission to configure app network access.'
                : 'The Firewall feature is turned off.'
            }
          />
        )}
      </AppResourceLayout>
    </EditorPage>
  )
}
