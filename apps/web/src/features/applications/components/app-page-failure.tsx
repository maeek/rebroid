'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { StateView } from '@/shared/ui/state-view'

export type AppPageFailureState = {
  kind: 'invalid-link' | 'not-found' | 'unavailable'
  requestId?: string
}

const failureContent = {
  'invalid-link': {
    title: 'Invalid app link',
    description: 'This link doesn’t point to an app. Find the app in All apps or ask for a new link.'
  },
  'not-found': {
    title: 'App not found',
    description: 'The app may have been removed, or your account may not have access to it.'
  },
  unavailable: {
    title: 'Could not load app',
    description: 'We couldn’t load the app details. Try again in a moment.'
  }
}

export const AppPageFailure = ({ failure = { kind: 'not-found' } }: { failure?: AppPageFailureState }) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { kind, requestId } = failure
  const { title, description } = failureContent[kind]

  return (
    <StateView
      scope='immersive'
      className='min-h-(--console-content-height)'
      kind={kind === 'unavailable' ? 'unavailable' : 'not-found'}
      title={title}
      description={description}
      artwork={kind === 'invalid-link' ? 'error' : undefined}
      requestId={requestId}
      actions={[
        ...(kind === 'unavailable'
          ? [
              {
                label: 'Try again',
                pending,
                pendingLabel: 'Retrying…',
                onClick: () => startTransition(() => router.refresh())
              }
            ]
          : []),
        { label: 'View all apps', href: '/apps', variant: kind === 'unavailable' ? 'secondary' : 'primary' }
      ]}
    />
  )
}
