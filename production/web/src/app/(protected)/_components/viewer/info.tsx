'use client'

import { cn } from '@/lib/utils'
import { AppInfoArtifactsSection } from './app-info/app-info-artifacts-section'
import { AppInfoNetworkSection } from './app-info/app-info-network-section'
import { AppInfoOverviewSection } from './app-info/app-info-overview-section'
import { AppInfoRuntimeSection } from './app-info/app-info-runtime-section'
import type { AppDefinition } from '../../(standard)/constants'

export const AppInfo = ({
  app,
  className,
  onAppChange
}: {
  app?: AppDefinition
  className?: string
  onAppChange?: (app: AppDefinition) => void
}) => {
  const handleAppChange = onAppChange ?? (() => undefined)

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <AppInfoOverviewSection app={app} />
      <AppInfoRuntimeSection app={app} />
      <AppInfoNetworkSection
        app={app}
        onAppChange={handleAppChange}
      />
      <AppInfoArtifactsSection app={app} />
    </div>
  )
}
