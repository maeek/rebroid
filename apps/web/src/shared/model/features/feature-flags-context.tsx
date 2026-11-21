'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { FeatureFlagKey, FeatureFlagManifest, FeatureFlagState } from '@/shared/contracts/feature-flags'

type FeatureFlagsContextValue = {
  manifest: FeatureFlagManifest | null
  isLoading: boolean
  getFeature: (key: FeatureFlagKey) => FeatureFlagState | undefined
  isFeatureEnabled: (key: FeatureFlagKey) => boolean
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null)

export const FeatureFlagsProvider = ({
  manifest: initialManifest = null,
  pendingManifest,
  children
}: {
  manifest?: FeatureFlagManifest | null
  pendingManifest?: Promise<FeatureFlagManifest | null>
  children: ReactNode
}) => {
  const [resolved, setResolved] = useState<{ manifest: FeatureFlagManifest | null }>()
  useEffect(() => {
    if (!pendingManifest) return
    let current = true
    void pendingManifest.then(
      manifest => {
        if (current) setResolved({ manifest })
      },
      () => {
        if (current) setResolved({ manifest: null })
      }
    )
    return () => {
      current = false
    }
  }, [pendingManifest])

  const manifest = pendingManifest && resolved ? resolved.manifest : initialManifest
  const isLoading = pendingManifest !== undefined && resolved === undefined
  const value = useMemo<FeatureFlagsContextValue>(() => {
    const states = new Map(manifest?.features.map(feature => [feature.key, feature]))
    return {
      manifest,
      isLoading,
      getFeature: key => states.get(key),
      isFeatureEnabled: key => {
        const feature = states.get(key)
        return feature?.enabled === true && feature.supported
      }
    }
  }, [isLoading, manifest])

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}

export const useFeatureFlags = () => {
  const value = useContext(FeatureFlagsContext)
  if (!value) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider.')
  return value
}
