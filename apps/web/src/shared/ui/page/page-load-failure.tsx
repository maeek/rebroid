'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { StateView, type StateViewAction } from '@/shared/ui/state-view'

export const PageLoadFailure = ({
  title,
  description,
  requestId,
  backAction,
  retry = true
}: {
  title: string
  description: string
  requestId?: string
  backAction: StateViewAction
  retry?: boolean
}) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <StateView
      scope='page'
      kind={retry ? 'unavailable' : 'not-found'}
      title={title}
      description={description}
      requestId={requestId}
      actions={[
        ...(retry
          ? [
              {
                label: 'Try again',
                pending,
                pendingLabel: 'Retrying…',
                onClick: () => startTransition(() => router.refresh())
              }
            ]
          : []),
        backAction
      ]}
    />
  )
}
