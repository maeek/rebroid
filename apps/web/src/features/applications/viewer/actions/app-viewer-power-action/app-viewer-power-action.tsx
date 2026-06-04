'use client'

import { RuntimePowerControls } from '@/features/applications/viewer/actions/app-viewer-power-action/controls/runtime-power-controls'
import { RuntimePowerDialogs } from '@/features/applications/viewer/actions/app-viewer-power-action/dialogs/runtime-power-dialogs'
import { RuntimePowerActionProvider } from '@/features/applications/viewer/actions/app-viewer-power-action/runtime-power-action-context'

export const AppViewerPowerAction = () => (
  <RuntimePowerActionProvider>
    <RuntimePowerControls />
    <RuntimePowerDialogs />
  </RuntimePowerActionProvider>
)
