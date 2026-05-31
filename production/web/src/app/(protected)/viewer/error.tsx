'use client'

import { IconAlertTriangle } from '@tabler/icons-react'
import { StatusSplash } from '@/features/shell/components/status-splash'

export default function ViewerErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className='flex min-h-screen items-center justify-center overflow-hidden bg-black p-6'>
      <StatusSplash
        title='Viewer unavailable'
        description='The live display could not finish loading.'
        detail='Try again, or restart the app if the viewer does not recover.'
        tone='danger'
        icon={<IconAlertTriangle className='size-10' />}
        primaryAction={{ label: 'Try again', onClick: reset }}
      />
    </main>
  )
}
