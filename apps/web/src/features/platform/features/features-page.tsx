'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useImmediateSave } from '@/hooks/use-immediate-save'
import { toast } from '@/hooks/use-toast'
import { updateFeatureFlagsAction } from '@/server/orchestrator/settings/actions'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
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
      description='Changes save immediately. Availability shows what the service has applied.'
    />
    <PageContent>{children}</PageContent>
  </StandardPage>
)

export const FeaturesPage = ({ initialManifest }: { initialManifest: FeatureFlagManifest }) => {
  const router = useRouter()
  const [manifest, setManifest] = useState(initialManifest)
  const { pendingId: pendingKey, savedId, save } = useImmediateSave()
  const changing = useRef(false)
  useEffect(() => {
    setManifest(current => (initialManifest.revision >= current.revision ? initialManifest : current))
  }, [initialManifest])
  const updateFeature = useCallback(
    async (key: FeatureFlagKey, enabled: boolean) => {
      if (changing.current) return
      changing.current = true
      try {
        await save(key, async () => {
          const updated = await updateFeatureFlagsAction({ revision: manifest.revision, changes: [{ key, enabled }] })
          setManifest(updated)
          router.refresh()
        })
      } catch (error) {
        router.refresh()
        toast({
          title: 'Could not update feature',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        })
      } finally {
        changing.current = false
      }
    },
    [manifest.revision, router, save]
  )
  return (
    <FeaturesPageLayout>
      <FeaturesGrid
        features={manifest.features}
        pendingKey={pendingKey}
        savedKey={savedId}
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
