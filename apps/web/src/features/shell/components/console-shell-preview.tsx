'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { PageHeader } from '@/shared/ui/page/page-header'
import { ProtectedShell } from './protected-shell'
import type { ShellUser } from './shell-user'

const user: ShellUser = {
  name: 'Preview operator',
  username: 'preview-operator',
  isPlatformAdmin: true,
  accentColor: 'blue',
  avatarDataUrl: null,
  mfaEnabled: false
}

export const ConsoleShellPreview = ({ initialSidebarCollapsed }: { initialSidebarCollapsed?: boolean }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { enabled: false } } }))
  return (
    <QueryClientProvider client={client}>
      <FeatureFlagsProvider manifest={{ revision: 1, features: [] }}>
        <ProtectedShell
          user={user}
          initialSidebarCollapsed={initialSidebarCollapsed}
          pollNavigation={false}
        >
          <PageHeader
            section={{ label: 'Runtime' }}
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
