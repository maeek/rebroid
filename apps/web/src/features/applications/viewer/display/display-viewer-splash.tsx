'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { StateView, type StateViewAction } from '@/shared/ui/state-view'

export const ViewerSplash = ({
  title,
  description,
  detail,
  appHref,
  retry = false,
  requestId,
  loading = false
}: {
  title: string
  description: string
  detail?: string
  appHref?: string
  retry?: boolean
  requestId?: string
  loading?: boolean
}) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const actions: StateViewAction[] = []
  if (retry) {
    actions.push({
      label: 'Try again',
      variant: 'primary',
      pending,
      pendingLabel: 'Retrying…',
      onClick: () => startTransition(() => router.refresh())
    })
  }
  if (!loading) {
    actions.push(appHref ? { label: 'Open app', href: appHref } : { label: 'Back to apps', href: '/apps' })
  }

  return (
    <main className='flex min-h-screen items-center justify-center bg-background p-6 text-foreground'>
      <StateView
        kind={loading ? 'loading' : 'unavailable'}
        scope='immersive'
        title={title}
        description={description}
        detail={detail}
        requestId={requestId}
        actions={actions}
      />
    </main>
  )
}
