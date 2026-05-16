'use client'

import classNames from 'classnames'
import { AppDefinition } from '../../(standard)/constants'
import { AppViewerDeleteAction } from './actions/app-viewer-delete-action'
import { AppViewerManageAction } from './actions/app-viewer-manage-action'
import { AppViewerPowerAction } from './actions/app-viewer-power-action'
import { AppViewerRestartAction } from './actions/app-viewer-restart-action'

export const AppViewerActions = ({ className, app }: { app?: AppDefinition; className?: string }) => {
  return (
    <div className={classNames('flex flex-row gap-2 items-center', className)}>
      <AppViewerManageAction appId={app?.id} />
      <AppViewerRestartAction app={app} />
      <AppViewerPowerAction app={app} />
      <AppViewerDeleteAction app={app} />
    </div>
  )
}
