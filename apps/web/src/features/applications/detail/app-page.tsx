'use client'
import { AppNotFoundSplash } from '@/features/applications/components/app-not-found-splash'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { resolveAppIconUrl } from '@/shared/model/media/image-url'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { StandardPageSplit } from '@/shared/ui/page/page-layout'
import { AppViewerContent } from './app-viewer-content'
import { AppViewerPane } from './app-viewer-pane'
import { AppWorkspaceContent } from './app-workspace-content'
import { ApplicationViewerProvider, useApplicationViewerContext } from './application-viewer-context'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

export const AppViewerPage = ({
  app,
  permissions,
  initialSettings,
  currentOwnerUserId,
  isAdmin,
  viewMode = 'workspace'
}: {
  app?: AppDefinition
  permissions: PermissionMap
  initialSettings: OrchestratorUiSettings
  currentOwnerUserId: string
  isAdmin: boolean
  viewMode?: 'workspace' | 'details'
}) => {
  return (
    <ApplicationViewerProvider
      app={app}
      currentOwnerUserId={currentOwnerUserId}
      initialSettings={initialSettings}
      isAdmin={isAdmin}
      permissions={permissions}
    >
      <AppViewerPageContent viewMode={viewMode} />
    </ApplicationViewerProvider>
  )
}

const AppViewerPageContent = ({ viewMode = 'workspace' }: { viewMode?: 'workspace' | 'details' }) => {
  const { app } = useApplicationViewerContext()
  const isDetailsView = viewMode === 'details'

  if (!app) {
    return <AppNotFoundSplash />
  }

  if (!isDetailsView) {
    return (
      <StandardPageSplit className='h-auto min-h-[calc(100vh-4rem)] items-start'>
        <PageBackdrop
          imageSrc={app.icon ? resolveAppIconUrl(app.icon) : null}
          opacity={0.08}
        />
        <AppWorkspaceContent />
      </StandardPageSplit>
    )
  }

  return (
    <StandardPageSplit className='h-auto min-h-[calc(100vh-4rem)] items-start'>
      <PageBackdrop
        imageSrc={app.icon ? resolveAppIconUrl(app.icon) : null}
        opacity={0.08}
      />
      <AppViewerContent />
      <AppViewerPane />
    </StandardPageSplit>
  )
}
