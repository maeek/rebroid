'use client'

import { IconMapQuestion } from '@tabler/icons-react'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'

export default function NotFound() {
  return (
    <StandardPage>
      <PageContent className='pt-8'>
        <StateView
          scope='page'
          kind='not-found'
          title='Page not found'
          description='This page may have moved, or the record may no longer exist.'
          icon={<IconMapQuestion className='size-10' />}
          actions={[{ label: 'Back to apps', href: '/apps' }]}
        />
      </PageContent>
    </StandardPage>
  )
}
