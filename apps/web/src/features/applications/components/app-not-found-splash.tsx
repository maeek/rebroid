'use client'

import { IconDeviceMobileQuestion } from '@tabler/icons-react'
import { StatusSplash } from '@/shared/ui/status-splash'

export const AppNotFoundSplash = () => {
  return (
    <div className='pl-72 max-lg:pl-0'>
      <section className='px-6 py-8 max-sm:px-4'>
        <StatusSplash
          title='App not found'
          description='This Android app may have been deleted, or your account may not have access to it.'
          icon={<IconDeviceMobileQuestion className='size-10' />}
          primaryAction={{ label: 'Refresh', onClick: () => window.location.reload() }}
          secondaryAction={{ label: 'Back to apps', href: '/apps' }}
        />
      </section>
    </div>
  )
}
