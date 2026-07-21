'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { FeatureFlagKey, FeatureFlagManifest, FeatureFlagState } from '@/shared/contracts/feature-flags'

type FeatureFlagsContextValue = {
  manifest: FeatureFlagManifest | null
  getFeature: (key: FeatureFlagKey) => FeatureFlagState | undefined
  isFeatureEnabled: (key: FeatureFlagKey) => boolean
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null)

export const FeatureFlagsProvider = ({
  manifest,
  children
}: {
  manifest: FeatureFlagManifest | null
  children: ReactNode
}) => {
  const value = useMemo<FeatureFlagsContextValue>(() => {
    const states = new Map(manifest?.features.map(feature => [feature.key, feature]))
    return {
      manifest,
      getFeature: key => states.get(key),
      isFeatureEnabled: key => {
        const feature = states.get(key)
        return feature?.enabled === true && feature.supported
      }
    }
  }, [manifest])

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}

export const useFeatureFlags = () => {
  const value = useContext(FeatureFlagsContext)
  if (!value) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider.')
  return value
}
