'use client'

import { useState } from 'react'
import { IconSettings, IconTerminal2 } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { AppLogsDialog } from '@/features/applications/viewer/logs/app-logs-dialog'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { AppViewerDeleteAction } from './app-viewer-delete-action'
import { AppViewerOpenAsMeAction } from './app-viewer-open-as-me-action'
import { AppViewerPowerAction } from './app-viewer-power-action/app-viewer-power-action'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

export const AppViewerActions = ({
  className,
  app,
  initialSettings,
  permissions,
  isForeignOwnedApp = false,
  mode = 'workspace'
}: {
  app?: AppDefinition
  className?: string
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
  isForeignOwnedApp?: boolean
  mode?: 'workspace' | 'details'
}) => {
  const [logsOpen, setLogsOpen] = useState(false)
  const canUseRuntime = !isForeignOwnedApp
  const canStart = hasPermission(permissions, 'applications:start')
  const canStop = hasPermission(permissions, 'applications:stop')
  const canViewLogs = canUseRuntime && hasPermission(permissions, 'applications:view-logs')
  const canDelete = mode !== 'workspace' && hasPermission(permissions, 'applications:delete')
  const showSettingsAction = Boolean(app?.id) && (mode === 'workspace' || mode === 'details')
  const showLogsAction = canViewLogs && mode === 'details'

  return (
    <div className={classNames('flex flex-row flex-wrap justify-end gap-2 items-center', className)}>
      <Visible when={canViewLogs}>
        <AppLogsDialog
          app={app}
          open={logsOpen}
          onOpenChange={setLogsOpen}
          hideTrigger
        />
      </Visible>
      <Visible when={isForeignOwnedApp}>
        <AppViewerOpenAsMeAction app={app} />
      </Visible>
      <Visible when={canUseRuntime && (canStart || canStop)}>
        <AppViewerPowerAction
          app={app}
          canStart={canStart}
          canStop={canStop}
          canSwitchProfile={hasPermission(permissions, 'applications:switch-profile')}
        />
      </Visible>
      <Visible when={canDelete}>
        <AppViewerDeleteAction
          app={app}
          initialSettings={initialSettings}
        />
      </Visible>
      <Visible when={showSettingsAction}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant='secondary'
              size='icon'
              aria-label='Manage application settings'
            >
              <Link href={`/app/${app?.id}/manage`}>
                <IconSettings className='size-4' />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </Visible>
      <Visible when={showLogsAction}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='secondary'
              size='icon'
              aria-label='View application logs'
              onClick={() => setLogsOpen(true)}
            >
              <IconTerminal2 className='size-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Logs</TooltipContent>
        </Tooltip>
      </Visible>
    </div>
  )
}
