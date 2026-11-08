'use client'

import { CastingSettingsPageClient } from '../../casting-settings-page-client'

export const PlatformDisplaySessionsPageSkeleton = () => (
  <CastingSettingsPageClient
    initialHealth={{ status: 'offline', ok: false, message: '' }}
    initialSessions={[]}
    applications={[]}
    owners={[]}
    loading
  />
)
