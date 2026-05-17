'use client'
import { useEffect, useState } from 'react'
import { IconDeviceMobileQuestion } from '@tabler/icons-react'
import { ProtectedSplitPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { StatusSplash } from '@/app/(protected)/_components/status-splash'
import { resolveAppIconUrl } from '@/lib/app-icons/url'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { getApplicationAction } from '@/server/orchestrator/applications/read-actions'
import { useForegroundRefresh } from '../../../../../hooks/use-foreground-refresh'
import { getAppRefreshIntervalMs } from '../../../../../lib/orchestrator/refresh'
import { rememberRecentApp } from '../../../../../lib/recent-apps'
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

  useEffect(() => {
    if (currentApp) {
      rememberRecentApp(currentApp)
    }
  }, [currentApp])

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
    return (
      <div className='pl-72 max-lg:pl-0'>
        <section className='px-6 py-8 max-sm:px-4'>
          <StatusSplash
            title='App not found'
            description='This Android app may have been deleted, or your account may not have access to it.'
            icon={<IconDeviceMobileQuestion className='size-10' />}
            primaryAction={{ label: 'Refresh', onClick: () => window.location.reload() }}
            secondaryAction={{ label: 'Back to apps', href: '/apps' }}
          />
        </section>
      </div>
    )
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
