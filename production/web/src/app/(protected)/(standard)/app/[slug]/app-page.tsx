'use client'
import { useEffect, useState } from 'react'
import { ProtectedSplitPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { resolveAppIconUrl } from '@/lib/app-icons/url'
import { getApplicationAction } from '@/lib/orchestrator/actions'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { useForegroundRefresh } from '../../../../../hooks/use-foreground-refresh'
import { getAppRefreshIntervalMs } from '../../../../../lib/orchestrator/refresh'
import { AppDefinition } from '../../constants'
import { AppViewerContent } from './app-viewer-content'
import { AppViewerPane } from './app-viewer-pane'

export const AppViewerPage = ({ app }: { app?: AppDefinition }) => {
  const [currentApp, setCurrentApp] = useState(app)
  const currentAppId = currentApp?.id
  const refreshIntervalMs = getAppRefreshIntervalMs(currentApp)

  useEffect(() => {
    setCurrentApp(app)
  }, [app])

  useForegroundRefresh({
    enabled: Boolean(currentAppId),
    intervalMs: refreshIntervalMs,
    refresh: async () => {
      if (!currentAppId) {
        return
      }

      try {
        const nextApp = await getApplicationAction(currentAppId)
        setCurrentApp(current => {
          const mapped = mapAndroidApplicationToAppDefinition(nextApp)
          return { ...mapped, icon: current?.icon ?? mapped.icon }
        })
      } catch {
        // Keep the last known app state on transient refresh failures.
      }
    }
  })

  if (!currentApp) {
    return <div className='pl-72 max-lg:pl-0 p-6'>App not found</div>
  }

  return (
    <ProtectedSplitPageLayout
      className='h-auto min-h-[calc(100vh-4rem)]'
      mainClassName='h-auto min-h-[calc(100vh-4rem)] items-start'
    >
      <div
        className='w-screen h-screen bg-primary/80 blur-3xl fixed top-0 left-0 -z-10 pointer-events-none'
        style={{
          backgroundImage: currentApp.icon ? `url("${resolveAppIconUrl(currentApp.icon)}")` : undefined,
          backgroundSize: '1000% 1000%',
          backgroundPosition: 'top left',
          opacity: 0.05
        }}
      />
      <AppViewerContent
        app={currentApp}
        onAppChange={nextApp => setCurrentApp(nextApp)}
      />
      <AppViewerPane app={currentApp} />
    </ProtectedSplitPageLayout>
  )
}
