'use client'

import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StandardPage>
      <PageContent className='pt-8'>
        <StateView
          scope='page'
          kind='error'
          title='This page couldn’t load'
          description='Something interrupted the request. Try again, or return to Overview to check the platform’s status.'
          requestId={error.digest}
          actions={[
            { label: 'Try again', onClick: reset },
            { label: 'Go to overview', href: '/platform' }
          ]}
        />
      </PageContent>
    </StandardPage>
  )
}
