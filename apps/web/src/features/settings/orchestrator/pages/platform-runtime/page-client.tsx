'use client'

import { useState } from 'react'
import { PlatformRuntimeForm } from '../../platform-runtime-form'
import { PlatformRuntimeUnavailable } from '../../platform-runtime-unavailable'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import type { AndroidRenderingSettings } from '@rebroid/android-application-core/redroid-runtime'

type RuntimePageData = {
  images: PlatformImage[]
  initialSettings: OrchestratorUiSettings
  appliedRenderingSettings: (AndroidRenderingSettings | null)[] | null
}

export const PlatformRuntimePageClient = ({ data }: { data: RuntimePageData | null }) => {
  const [lastData, setLastData] = useState(data)
  // Retain the mounted editor and its draft if a later server refresh fails.
  if (data && data !== lastData) setLastData(data)
  const availableData = data ?? lastData
  if (!availableData) return <PlatformRuntimeUnavailable />
  return (
    <PlatformRuntimeForm
      {...availableData}
      unavailable={!data}
    />
  )
}
