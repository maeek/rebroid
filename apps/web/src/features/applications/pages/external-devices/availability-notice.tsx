'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'

const availabilityCopy = {
  not_configured: {
    title: 'ADB broker is not configured',
    detail:
      'Set the external ADB broker URL and shared secret for the orchestrator. The main Compose stack supplies the URL.'
  },
  feature_disabled: {
    title: 'External devices are turned off',
    detail: 'Enable External devices in Feature management to allow registration and connections.'
  },
  broker_unavailable: {
    title: 'ADB broker is unavailable',
    detail:
      'Rebroid could not confirm the broker is reachable and accepts its configuration. Check the broker service and shared secret.'
  }
} as const

export function AvailabilityNotice({
  status,
  administrator
}: {
  status: keyof typeof availabilityCopy
  administrator: boolean
}) {
  const router = useRouter()
  const [checking, startCheck] = useTransition()
  const { title, detail } = availabilityCopy[status]
  const actions =
    status === 'feature_disabled' && administrator ? (
      <Button
        asChild
        variant='outline'
      >
        <Link href='/platform/features'>Feature management</Link>
      </Button>
    ) : status === 'broker_unavailable' ? (
      <MutationButton
        variant='outline'
        pending={checking}
        pendingLabel='Checking…'
        onClick={() => startCheck(() => router.refresh())}
      >
        Check broker again
      </MutationButton>
    ) : undefined

  return (
    <Notice
      tone={status === 'broker_unavailable' ? 'warning' : 'info'}
      title={title}
      description={administrator ? detail : 'Contact your Rebroid administrator to restore external device access.'}
      actions={actions}
    />
  )
}
