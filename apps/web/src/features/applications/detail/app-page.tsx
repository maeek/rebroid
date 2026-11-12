'use client'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppPageFailure } from '@/features/applications/components/app-page-failure'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { AppManage } from '@/features/applications/manage/app-manage'
import { AppManageProfiles } from '@/features/applications/manage/app-manage-profiles'
import { StandardPageSplit } from '@/shared/ui/page/page-layout'
import { AppDeviceLayout } from './app-device-layout'
import { AppResourceBreadcrumbs } from './app-resource-breadcrumbs'
import { AppResourceHome } from './app-resource-home'
import { resolveAppResourceView } from './app-resource-links'
import { AppViewerContent } from './app-viewer-content'
import { AppViewerPane } from './app-viewer-pane'
import { AppWorkspaceContent } from './app-workspace-content'
import { ApplicationViewerProvider, useApplicationViewerContext } from './application-viewer-context'
import type { InspectedContainerCommand } from '@/features/applications/manage/app-manage-technical-details'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

export const AppViewerPage = ({
  app,
  permissions,
  initialSettings,
  currentOwnerUserId,
  isAdmin,
  viewMode = 'workspace',
  activity,
  inspectedCommand
}: {
  app?: AppDefinition
  permissions: PermissionMap
  initialSettings: OrchestratorUiSettings
  currentOwnerUserId: string
  isAdmin: boolean
  viewMode?: 'workspace' | 'details'
  activity?: ReactNode
  inspectedCommand?: InspectedContainerCommand | null
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
        inspectedCommand={inspectedCommand}
      />
    </ApplicationViewerProvider>
  )
}

const AppViewerPageContent = ({
  viewMode = 'workspace',
  activity,
  inspectedCommand
}: {
  viewMode?: 'workspace' | 'details'
  activity?: ReactNode
  inspectedCommand?: InspectedContainerCommand | null
}) => {
  const { app, permissions } = useApplicationViewerContext()
  const search = useSearchParams()
  const view = resolveAppResourceView(search.get('view'))
  const isDetailsView = viewMode === 'details'

  if (!app) {
    return <AppPageFailure />
  }

  if (!isDetailsView) {
    return (
      <AppDeviceLayout
        breadcrumbs={
          <AppResourceBreadcrumbs
            appId={app.id}
            appName={app.name}
            view={view}
          />
        }
        viewer={<AppViewerPane placement='top' />}
        contained={view === 'ai-agent'}
      >
        <AppResourceBody
          view={view}
          activity={activity}
          inspectedCommand={inspectedCommand}
          app={app}
          permissions={permissions}
        />
      </AppDeviceLayout>
    )
  }

  return (
    <StandardPageSplit className='h-auto items-start'>
      <AppViewerContent />
      <AppViewerPane />
    </StandardPageSplit>
  )
}

const AppResourceBody = ({
  view,
  activity,
  app,
  permissions,
  inspectedCommand
}: {
  view: ReturnType<typeof resolveAppResourceView>
  activity?: ReactNode
  app: AppDefinition
  permissions: PermissionMap
  inspectedCommand?: InspectedContainerCommand | null
}) => {
  switch (view) {
    case 'configuration':
      return <AppManage />
    case 'profiles':
      return (
        <AppManageProfiles
          app={app}
          permissions={permissions}
        />
      )
    case 'ai-agent':
    case 'workflows':
    case 'files':
      return <AppWorkspaceContent toolId={view} />
    default:
      return (
        <AppResourceHome
          view={view}
          activity={activity}
          inspectedCommand={inspectedCommand}
        />
      )
  }
}
