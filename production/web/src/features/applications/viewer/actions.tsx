'use client'

import classNames from 'classnames'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { AppViewerDeleteAction } from './actions/app-viewer-delete-action'
import { AppViewerManageAction } from './actions/app-viewer-manage-action'
import { AppViewerPowerAction } from './actions/app-viewer-power-action'
import { AppViewerRestartAction } from './actions/app-viewer-restart-action'
import { AppLogsDialog } from './app-logs-dialog'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

export const AppViewerActions = ({
  className,
  app,
  initialSettings,
  permissions
}: {
  app?: AppDefinition
  className?: string
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
}) => {
  return (
    <div className={classNames('flex flex-row gap-2 items-center', className)}>
      <AppViewerManageAction appId={app?.id} />
      {hasPermission(permissions, 'applications:view-logs') ? <AppLogsDialog app={app} /> : null}
      {hasPermission(permissions, 'applications:start') || hasPermission(permissions, 'applications:stop') ? (
        <AppViewerPowerAction
          app={app}
          canStart={hasPermission(permissions, 'applications:start')}
          canStop={hasPermission(permissions, 'applications:stop')}
        />
      ) : null}
      {hasPermission(permissions, 'applications:start') && hasPermission(permissions, 'applications:stop') ? (
        <AppViewerRestartAction app={app} />
      ) : null}
      {hasPermission(permissions, 'applications:delete') ? (
        <AppViewerDeleteAction
          app={app}
          initialSettings={initialSettings}
        />
      ) : null}
    </div>
  )
}
