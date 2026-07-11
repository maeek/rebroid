'use client'

import { IconAlertTriangle } from '@tabler/icons-react'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { StatusSplash } from '@/shared/ui/status-splash'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StandardPage>
      <section className='px-6 py-8 max-sm:px-4'>
        <StatusSplash
          title='Something went sideways'
          description='The page could not finish loading. Try again, or go back to the app list.'
          detail={error.message}
          tone='danger'
          icon={<IconAlertTriangle className='size-10' />}
          primaryAction={{ label: 'Try again', onClick: reset }}
          secondaryAction={{ label: 'Back to apps', href: '/apps' }}
        />
      </section>
    </StandardPage>
  )
}
