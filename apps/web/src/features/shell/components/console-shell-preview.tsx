'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { pollingQueryKey } from '@/hooks/use-polling-query'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { PageHeader } from '@/shared/ui/page/page-header'
import { ProtectedShell } from './protected-shell'
import type { ShellUser } from './shell-user'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'
import type { RecentApp } from '@/shared/contracts/recent-app'

const user: ShellUser = {
  name: 'Preview operator',
  isPlatformAdmin: true,
  canCreateApp: true,
  canManageWorkflows: true,
  avatarDataUrl: null
}

const defaultManifest: FeatureFlagManifest = { revision: 1, features: [] }

export const ConsoleShellPreview = ({
  initialSidebarCollapsed,
  manifest = defaultManifest,
  recentApps,
  children
}: {
  initialSidebarCollapsed?: boolean
  manifest?: FeatureFlagManifest
  recentApps?: RecentApp[]
  children?: ReactNode
}) => {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { enabled: false } } })
    if (recentApps) queryClient.setQueryData(pollingQueryKey('navigation:recent-apps'), recentApps)
    return queryClient
  })
  return (
    <QueryClientProvider client={client}>
      <FeatureFlagsProvider manifest={manifest}>
        <ProtectedShell
          user={user}
          initialSidebarCollapsed={initialSidebarCollapsed}
          pollNavigation={false}
        >
          {children ?? (
            <PageHeader
              section={{ label: 'Docker' }}
              trail={[{ label: 'Containers', href: '/runtime/containers' }]}
              title={'rebroid-runtime-' + 'inventory-worker-'.repeat(8)}
              actions={
                <>
                  <Button variant='secondary'>Stop</Button>
                  <Button variant='danger'>Remove</Button>
                </>
              }
            />
          )}
        </ProtectedShell>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  )
}
