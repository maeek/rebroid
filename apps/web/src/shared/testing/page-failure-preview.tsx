import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { StateView } from '@/shared/ui/state-view'

export const PageFailurePreview = ({ kind }: { kind: 'unavailable' | 'not-found' | 'error' }) => {
  if (kind === 'unavailable')
    return (
      <PlatformRouteUnavailable
        title='Images'
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
        section={{ label: 'Runtime' }}
      />
    )
  return (
    <StandardPage>
      <PageHeader
        title='Image details'
        section={{ label: 'Runtime' }}
      />
      <PageContent>
        {kind === 'not-found' ? (
          <PageLoadFailure
            title='Image not found'
            description='This image may have been removed. Return to the list to find an available image.'
            retry={false}
            backAction={{ label: 'Back to images', href: '/runtime/images' }}
          />
        ) : (
          <StateView
            scope='page'
            headingLevel={2}
            kind='error'
            title='This page couldn’t load'
            description='Something interrupted the request. Try again in a moment.'
            requestId='preview-request'
            actions={[{ label: 'Go to overview', href: '/platform' }]}
          />
        )}
      </PageContent>
    </StandardPage>
  )
}
