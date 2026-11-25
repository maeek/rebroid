'use client'

import { useEffect, type ReactNode } from 'react'
import { IconArrowUpRight } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Section } from '@/components/ui/section'
import { panelSurfaceClassName } from '@/components/ui/surface'
import { getBff } from '@/lib/http/bff'
import { recentAppsUpdatedEvent } from '@/shared/model/recent-apps/recent-apps'
import { AppGalleryCard } from '@/shared/ui/app-icon/app-gallery-card'
import { AppGalleryGrid } from '@/shared/ui/app-icon/app-gallery-grid'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { RecentApp } from '@/shared/contracts/recent-app'

export const recentlyOpenedAppsQueryKey = ['applications', 'recently-opened'] as const

export const PlatformRecentApps = () => {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({
    queryKey: recentlyOpenedAppsQueryKey,
    queryFn: ({ signal }) => getBff<RecentApp[]>('/api/bff/devices/recent', signal),
    refetchInterval: query => {
      const apps = query.state.data
      if (apps?.some(app => app.status === 'running' && app.canViewSnapshot)) return 5_000
      return apps?.some(app => app.canViewSnapshot) ? 15_000 : false
    }
  })
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: recentlyOpenedAppsQueryKey })
    window.addEventListener(recentAppsUpdatedEvent, refresh)
    return () => window.removeEventListener(recentAppsUpdatedEvent, refresh)
  }, [queryClient])
  return (
    <PlatformRecentAppsContent
      apps={data}
      loading={isPending}
      error={isError}
    />
  )
}

export const PlatformRecentAppsContent = ({
  apps,
  loading = false,
  error = false
}: {
  apps?: RecentApp[]
  loading?: boolean
  error?: boolean
}) => {
  let content: ReactNode = (
    <p className={`${panelSurfaceClassName} p-4 text-sm text-foreground-muted`}>
      {error
        ? 'Recently opened devices could not be loaded. Refresh Overview to try again.'
        : 'Apps and devices you open will appear here for quick access.'}
    </p>
  )
  if (loading) {
    content = (
      <div
        role='status'
        aria-label='Loading recently opened devices'
      >
        <AppGalleryGrid label='Recently opened devices'>
          {Array.from({ length: 5 }, (_, index) => (
            <AppGalleryCard key={index} />
          ))}
        </AppGalleryGrid>
      </div>
    )
  } else if (apps?.length) {
    content = (
      <AppGalleryGrid label='Recently opened devices'>
        {apps.map(app => (
          <AppGalleryCard
            key={app.id}
            app={app}
          />
        ))}
      </AppGalleryGrid>
    )
  }

  return (
    <Section
      surface='plain'
      title='Recently opened'
      headingSpacing='default'
      actions={
        <ResourceLink
          href='/apps'
          className='inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium'
        >
          All apps{' '}
          <IconArrowUpRight
            className='size-4'
            aria-hidden='true'
          />
        </ResourceLink>
      }
    >
      {content}
    </Section>
  )
}
