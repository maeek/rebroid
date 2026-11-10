'use client'

import { useEffect } from 'react'
import { IconArrowUpRight } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Section } from '@/components/ui/section'
import { panelSurfaceClassName } from '@/components/ui/surface'
import { getBff } from '@/lib/http/bff'
import { recentAppsUpdatedEvent } from '@/shared/model/recent-apps/recent-apps'
import { AppShortcut } from '@/shared/ui/app-icon/app-shortcut'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { RecentApp } from '@/shared/contracts/recent-app'

export const recentlyOpenedAppsQueryKey = ['applications', 'recently-opened'] as const

export const PlatformRecentApps = () => {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({
    queryKey: recentlyOpenedAppsQueryKey,
    queryFn: () => getBff<RecentApp[]>('/api/bff/applications/recent')
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
}) => (
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
    {loading ? (
      <div
        role='status'
        aria-label='Loading recently opened apps'
        className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5'
      >
        {Array.from({ length: 5 }, (_, index) => (
          <AppShortcut
            key={index}
            loading
          />
        ))}
      </div>
    ) : (
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5'>
        {apps?.length ? (
          apps.map(app => (
            <AppShortcut
              key={app.id}
              app={app}
            />
          ))
        ) : (
          <p className={`${panelSurfaceClassName} col-span-full p-4 text-sm text-foreground-muted`}>
            {error
              ? 'Recently opened apps could not be loaded. Refresh Overview to try again.'
              : 'Apps you open will appear here for quick access.'}
          </p>
        )}
      </div>
    )}
  </Section>
)
