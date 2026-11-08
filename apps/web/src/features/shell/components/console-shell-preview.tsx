'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { PageHeader } from '@/shared/ui/page/page-header'
import Sidebar from './sidebar'

export const ConsoleShellPreview = () => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { enabled: false } } }))
  return (
    <QueryClientProvider client={client}>
      <FeatureFlagsProvider manifest={{ revision: 1, features: [] }}>
        <Sidebar
          initialUser={{
            name: 'Preview operator',
            role: 'admin',
            accentColor: 'blue',
            avatarDataUrl: null,
            mfaEnabled: false
          }}
        />
        <div className='pt-16 lg:pl-72'>
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
        </div>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  )
}
