import type { ReactNode } from 'react'
import { Notice } from '@/components/ui/notice'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { RuntimeToolsPanel } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tools-panel'
import { AppResourceBreadcrumbs } from './app-resource-breadcrumbs'
import { AppResourceLayout } from './app-resource-layout'
import { AppResourceNavigation } from './app-resource-navigation'
import { useApplicationViewerApp } from './application-viewer-context'
import type { RuntimeToolId } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tool-definitions'

export const AppWorkspaceContent = ({ toolId }: { toolId: RuntimeToolId }) => {
  return (
    <AppWorkspaceLayout toolId={toolId}>
      <RuntimeToolsPanel toolId={toolId} />
    </AppWorkspaceLayout>
  )
}

export const AppWorkspaceLayout = ({ toolId, children }: { toolId: RuntimeToolId; children: ReactNode }) => {
  const { app, permissions, isForeignOwnedApp, canViewAuditActivity } = useApplicationViewerApp()
  return (
    <AppResourceLayout
      workspace={toolId === 'ai-agent'}
      breadcrumbs={
        <AppResourceBreadcrumbs
          appId={app.id}
          appName={app.name}
          view={toolId}
        />
      }
      heading={
        <AppViewerHeading
          app={app}
          showStatusBadge
        >
          <AppViewerActions mode='resource' />
        </AppViewerHeading>
      }
      navigation={
        <AppResourceNavigation
          appId={app.id}
          active={toolId}
          permissions={permissions}
          isForeignOwnedApp={isForeignOwnedApp}
          canViewAuditActivity={canViewAuditActivity}
        />
      }
      status={null}
    >
      {isForeignOwnedApp ? (
        <Notice
          title='Separate session required'
          description='Runtime tools are only available in your own app session.'
        />
      ) : (
        children
      )}
    </AppResourceLayout>
  )
}
