'use client'

import { IconMapQuestion } from '@tabler/icons-react'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { StatusSplash } from '@/shared/ui/status-splash'

export default function NotFound() {
  return (
    <StandardPage>
      <section className='px-6 py-8 max-sm:px-4'>
        <StatusSplash
          title='Page not found'
          description='This page may have moved, or the record may no longer exist.'
          icon={<IconMapQuestion className='size-10' />}
          primaryAction={{ label: 'Refresh', onClick: () => window.location.reload() }}
          secondaryAction={{ label: 'Back to apps', href: '/apps' }}
        />
      </section>
    </StandardPage>
  )
}
