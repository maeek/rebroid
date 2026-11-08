'use client'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppNotFoundSplash } from '@/features/applications/components/app-not-found-splash'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { resolveAppIconUrl } from '@/shared/model/media/image-url'
import { PageBackdrop } from '@/shared/ui/page/page-backdrop'
import { StandardPageSplit } from '@/shared/ui/page/page-layout'
import { AppDeviceLayout } from './app-device-layout'
import { AppResourceHome } from './app-resource-home'
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
  viewMode = 'workspace',
  activity
}: {
  app?: AppDefinition
  permissions: PermissionMap
  initialSettings: OrchestratorUiSettings
  currentOwnerUserId: string
  isAdmin: boolean
  viewMode?: 'workspace' | 'details'
  activity?: ReactNode
}) => {
  return (
    <ApplicationViewerProvider
      app={app}
      currentOwnerUserId={currentOwnerUserId}
      initialSettings={initialSettings}
      isAdmin={isAdmin}
      permissions={permissions}
    >
      <AppViewerPageContent
        viewMode={viewMode}
        activity={activity}
      />
    </ApplicationViewerProvider>
  )
}

const AppViewerPageContent = ({
  viewMode = 'workspace',
  activity
}: {
  viewMode?: 'workspace' | 'details'
  activity?: ReactNode
}) => {
  const { app } = useApplicationViewerContext()
  const search = useSearchParams()
  const view = search.get('view') ?? 'overview'
  const isDetailsView = viewMode === 'details'

  if (!app) {
    return <AppNotFoundSplash />
  }

  if (!isDetailsView) {
    const section = view === 'activity' || view === 'diagnostics' ? view : 'overview'
    return (
      <AppDeviceLayout
        viewer={<AppViewerPane placement='top' />}
        contained={view === 'ai-agent'}
      >
        <PageBackdrop
          imageSrc={app.icon ? resolveAppIconUrl(app.icon) : null}
          opacity={0.08}
        />
        {view === 'ai-agent' || view === 'workflows' || view === 'clipboard' || view === 'files' ? (
          <AppWorkspaceContent toolId={view} />
        ) : (
          <AppResourceHome
            view={section}
            activity={activity}
          />
        )}
      </AppDeviceLayout>
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
