'use client'

import { IconAlertTriangle } from '@tabler/icons-react'
import { StateView } from '@/shared/ui/state-view'

export default function ViewerErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className='flex min-h-screen items-center justify-center overflow-hidden bg-black p-6'>
      <StateView
        scope='immersive'
        kind='error'
        title='Viewer unavailable'
        description='The live display could not finish loading.'
        detail='Try again, or restart the app if the viewer does not recover.'
        icon={<IconAlertTriangle className='size-10' />}
        actions={[{ label: 'Try again', onClick: reset }]}
      />
    </main>
  )
}
