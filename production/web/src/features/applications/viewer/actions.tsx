'use client'

import classNames from 'classnames'
import { Visible } from '@/components/ui/visible'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { AppViewerDeleteAction } from './actions/app-viewer-delete-action'
import { AppViewerManageAction } from './actions/app-viewer-manage-action'
import { AppViewerOpenAsMeAction } from './actions/app-viewer-open-as-me-action'
import { AppViewerPowerAction } from './actions/app-viewer-power-action'
import { AppViewerRestartAction } from './actions/app-viewer-restart-action'
import { AppLogsDialog } from './app-logs-dialog'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

export const AppViewerActions = ({
  className,
  app,
  initialSettings,
  permissions,
  isForeignOwnedApp = false
}: {
  app?: AppDefinition
  className?: string
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
  isForeignOwnedApp?: boolean
}) => {
  const canUseRuntime = !isForeignOwnedApp

  return (
    <div className={classNames('flex flex-row gap-2 items-center', className)}>
      <AppViewerManageAction appId={app?.id} />
      <Visible when={isForeignOwnedApp}>
        <AppViewerOpenAsMeAction app={app} />
      </Visible>
      <Visible when={canUseRuntime && hasPermission(permissions, 'applications:view-logs')}>
        <AppLogsDialog app={app} />
      </Visible>
      <Visible
        when={
          canUseRuntime &&
          (hasPermission(permissions, 'applications:start') || hasPermission(permissions, 'applications:stop'))
        }
      >
        <AppViewerPowerAction
          app={app}
          canStart={hasPermission(permissions, 'applications:start')}
          canStop={hasPermission(permissions, 'applications:stop')}
          canSwitchProfile={hasPermission(permissions, 'applications:switch-profile')}
        />
      </Visible>
      <Visible
        when={
          canUseRuntime &&
          hasPermission(permissions, 'applications:start') &&
          hasPermission(permissions, 'applications:stop')
        }
      >
        <AppViewerRestartAction app={app} />
      </Visible>
      <Visible when={hasPermission(permissions, 'applications:delete')}>
        <AppViewerDeleteAction
          app={app}
          initialSettings={initialSettings}
        />
      </Visible>
    </div>
  )
}
