import { Suspense } from 'react'
import { CastingSettingsPageClient } from '../../casting-settings-page-client'
import { loadPlatformDisplaySessionsPageData } from './page-data.server'
import { PlatformDisplaySessionsPageSkeleton } from './page-skeleton'

const PlatformDisplaySessionsPageContent = async () => {
  const { applications, owners, sessions, sidecarHealth } = await loadPlatformDisplaySessionsPageData()

  return (
    <CastingSettingsPageClient
      initialHealth={sidecarHealth}
      initialSessions={sessions}
      applications={applications}
      owners={owners}
    />
  )
}

export function PlatformDisplaySessionsPageEntry() {
  return (
    <Suspense fallback={<PlatformDisplaySessionsPageSkeleton />}>
      <PlatformDisplaySessionsPageContent />
    </Suspense>
  )
}
