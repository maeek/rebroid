'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { updateFeatureFlagsAction } from '@/server/orchestrator/settings/actions'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'

export const FeaturesPage = ({ initialManifest }: { initialManifest: FeatureFlagManifest }) => {
  const router = useRouter()
  const [manifest, setManifest] = useState(initialManifest)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const updateFeature = async (key: FeatureFlagManifest['features'][number]['key'], enabled: boolean) => {
    setPendingKey(key)
    try {
      const updated = await updateFeatureFlagsAction({ revision: manifest.revision, changes: [{ key, enabled }] })
      setManifest(updated)
      router.refresh()
      toast({ title: `${key} ${enabled ? 'enabled' : 'disabled'}`, variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not update feature',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <StandardPage>
      <PageHeader
        section={{ label: 'Platform', href: '/platform' }}
        title='Features'
        description='Enable or disable platform capabilities without restarting the deployment.'
      />
      <PageContent>
        <Section
          surface='panel'
          title='Feature flags'
          description={`Configuration revision ${manifest.revision}`}
          contentClassName='divide-y divide-border pt-4'
        >
          {manifest.features.map(feature => (
            <div
              key={feature.key}
              className='flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0'
            >
              <div className='grid gap-1'>
                <span className='font-medium'>{feature.key}</span>
                <span className='text-sm text-foreground-muted'>{feature.description}</span>
                {!feature.supported && <span className='text-xs text-danger'>Unavailable in this deployment</span>}
                {!feature.mutable && <span className='text-xs text-foreground-muted'>Controlled by deployment</span>}
                {feature.syncStatus !== 'applied' && (
                  <span className='text-xs text-foreground-muted'>Synchronization: {feature.syncStatus}</span>
                )}
              </div>
              <Switch
                checked={feature.enabled}
                disabled={!feature.mutable || !feature.supported || pendingKey !== null}
                aria-label={`Enable ${feature.key}`}
                onCheckedChange={enabled => void updateFeature(feature.key, enabled)}
              />
            </div>
          ))}
        </Section>
      </PageContent>
    </StandardPage>
  )
}
