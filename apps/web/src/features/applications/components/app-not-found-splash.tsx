'use client'

import { IconDeviceMobileQuestion } from '@tabler/icons-react'
import { StateView } from '@/shared/ui/state-view'

export const AppNotFoundSplash = () => {
  return (
    <section className='px-6 py-8 max-sm:px-4'>
      <StateView
        scope='page'
        kind='not-found'
        title='App not found'
        description='This Android app may have been deleted, or your account may not have access to it.'
        icon={<IconDeviceMobileQuestion className='size-10' />}
        actions={[{ label: 'Back to apps', href: '/apps' }]}
      />
    </section>
  )
}
