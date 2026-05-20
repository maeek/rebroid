'use client'

import { ClipboardToolsSection } from './clipboard-tools-section'
import { DownloadsToolsSection } from './downloads-tools-section'
import { StreamingToolsSection } from './streaming-tools-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

export const RuntimeToolsPanel = ({
  app,
  permissions,
  viewerSettings,
  onViewerSettingsChange
}: {
  app: AppDefinition
  permissions: PermissionMap
  viewerSettings: ViewerSettings
  onViewerSettingsChange: (settings: ViewerSettings) => void
}) => (
  <div className='flex w-full flex-col gap-5'>
    <ClipboardToolsSection
      app={app}
      permissions={permissions}
    />
    <DownloadsToolsSection
      app={app}
      permissions={permissions}
    />
    <StreamingToolsSection
      viewerSettings={viewerSettings}
      onViewerSettingsChange={onViewerSettingsChange}
    />
  </div>
)
