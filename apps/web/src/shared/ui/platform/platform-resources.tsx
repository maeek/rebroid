'use client'

import { Section } from '@/components/ui/section'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'
import type { SystemResources } from '@/shared/contracts/system-resources'

export const PlatformResources = ({
  resources
}: {
  resources?: SystemResources
  isRefreshing?: boolean
  onRefresh?: () => Promise<void>
}) => {
  return (
    <Section
      surface='plain'
      title='Managed inventory'
      headingSpacing='default'
      contentClassName='gap-4'
      className='w-full'
    >
      <div className='grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
        <QuickGlanceCard
          label='Containers'
          value={resources?.containersTotal ?? 0}
          hint='Managed containers visible to Docker'
        />
        <QuickGlanceCard
          label='Running'
          value={resources?.containersRunning ?? 0}
          hint='Managed containers currently running'
        />
        <QuickGlanceCard
          label='Stopped'
          value={resources?.containersStopped ?? 0}
          hint='Managed containers not currently running'
        />
      </div>
    </Section>
  )
}
