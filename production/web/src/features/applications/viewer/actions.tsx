'use client'

import { useState } from 'react'
import { IconDotsVertical, IconInfoCircle, IconSettings, IconTerminal2 } from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { AppViewerDeleteAction } from './actions/app-viewer-delete-action'
import { AppViewerOpenAsMeAction } from './actions/app-viewer-open-as-me-action'
import { AppViewerPowerAction } from './actions/app-viewer-power-action'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { AppLogsDialog } from '@/features/applications/viewer/app-logs-dialog'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'

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
  const showOverflowMenu = Boolean(app?.id) && mode === 'workspace'
  const showDetailsAction = Boolean(app?.id) && mode === 'workspace'
  const showLogsAction = canViewLogs && mode === 'details'
  const showSettingsAction = Boolean(app?.id) && mode === 'details'

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
      <Visible when={showDetailsAction}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant='secondary'
              size='icon'
              aria-label='View application details'
            >
              <Link href={`/app/${app?.id}/details`}>
                <IconInfoCircle className='size-4' />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Details</TooltipContent>
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
      <Visible when={showOverflowMenu}>
        <Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='icon'
                  aria-label='Application actions'
                >
                  <IconDotsVertical className='size-4' />
                </Button>
              </TooltipTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align='end'
              className='min-w-40'
            >
              <Visible when={canViewLogs}>
                <DropdownMenuItem
                  className='gap-2'
                  onSelect={() => setLogsOpen(true)}
                >
                  <IconTerminal2 className='size-4' />
                  Logs
                </DropdownMenuItem>
              </Visible>
              <DropdownMenuItem asChild>
                <Link
                  href={`/app/${app?.id}/manage`}
                  className='gap-2'
                >
                  <IconSettings className='size-4' />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipContent>More actions</TooltipContent>
        </Tooltip>
      </Visible>
    </div>
  )
}
