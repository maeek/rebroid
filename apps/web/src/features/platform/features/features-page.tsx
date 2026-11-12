'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { updateFeatureFlagsAction } from '@/server/orchestrator/settings/actions'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { featureLabel } from './feature-presentation'
import { FeaturesGrid } from './features-grid'
import type { FeatureFlagKey, FeatureFlagManifest } from '@/shared/contracts/feature-flags'

const FeaturesPageLayout = ({ children }: { children: ReactNode }) => (
  <StandardPage
    gridToolbar
    className='gap-2'
  >
    <PageHeader
      section={{ label: 'Administration' }}
      title='Feature management'
      description='Manage platform capabilities and their availability. Changes are saved immediately.'
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)

export const FeaturesPage = ({ initialManifest }: { initialManifest: FeatureFlagManifest }) => {
  const router = useRouter()
  const [manifest, setManifest] = useState(initialManifest)
  const [pendingKey, setPendingKey] = useState<FeatureFlagKey | null>(null)
  const changing = useRef(false)
  useEffect(() => {
    setManifest(current => (initialManifest.revision >= current.revision ? initialManifest : current))
  }, [initialManifest])
  const updateFeature = useCallback(
    async (key: FeatureFlagKey, enabled: boolean) => {
      if (changing.current) return
      changing.current = true
      setPendingKey(key)
      try {
        const updated = await updateFeatureFlagsAction({ revision: manifest.revision, changes: [{ key, enabled }] })
        setManifest(updated)
        router.refresh()
        toast({ title: `${featureLabel(key)} ${enabled ? 'enabled' : 'disabled'}`, variant: 'success' })
      } catch (error) {
        router.refresh()
        toast({
          title: 'Could not update feature',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        })
      } finally {
        changing.current = false
        setPendingKey(null)
      }
    },
    [manifest.revision, router]
  )
  return (
    <FeaturesPageLayout>
      <FeaturesGrid
        features={manifest.features}
        pendingKey={pendingKey}
        onUpdate={updateFeature}
      />
    </FeaturesPageLayout>
  )
}

export const FeaturesPageLoading = () => {
  const { manifest } = useFeatureFlags()
  return (
    <FeaturesPageLayout>
      <FeaturesGrid
        features={manifest?.features ?? []}
        pendingKey={null}
        onUpdate={() => Promise.resolve()}
        loading
      />
    </FeaturesPageLayout>
  )
}
