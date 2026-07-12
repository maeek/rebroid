'use client'

import { IconAlertTriangle } from '@tabler/icons-react'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StandardPage>
      <PageContent className='pt-8'>
        <StateView
          scope='page'
          kind='error'
          title='Something went sideways'
          description='The page could not finish loading. Try again, or go back to the app list.'
          requestId={error.digest}
          icon={<IconAlertTriangle className='size-10' />}
          actions={[
            { label: 'Try again', onClick: reset },
            { label: 'Back to apps', href: '/apps' }
          ]}
        />
      </PageContent>
    </StandardPage>
  )
}
