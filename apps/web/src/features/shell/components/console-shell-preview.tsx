'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { PageHeader } from '@/shared/ui/page/page-header'
import { ProtectedShell } from './protected-shell'
import type { ShellUser } from './shell-user'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'

const user: ShellUser = {
  name: 'Preview operator',
  isPlatformAdmin: true,
  avatarDataUrl: null
}

const defaultManifest: FeatureFlagManifest = { revision: 1, features: [] }

export const ConsoleShellPreview = ({
  initialSidebarCollapsed,
  manifest = defaultManifest
}: {
  initialSidebarCollapsed?: boolean
  manifest?: FeatureFlagManifest
}) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { enabled: false } } }))
  return (
    <QueryClientProvider client={client}>
      <FeatureFlagsProvider manifest={manifest}>
        <ProtectedShell
          user={user}
          initialSidebarCollapsed={initialSidebarCollapsed}
          pollNavigation={false}
        >
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
        </ProtectedShell>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  )
}
