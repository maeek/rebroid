'use client'

import { useEffect, useState } from 'react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import type { ServiceContainers } from '@/shared/contracts/diagnostics'

export const useServiceContainerLinks = (pending?: Promise<ServiceContainers | null>) => {
  const [containers, setContainers] = useState<ServiceContainers>()
  const [settled, setSettled] = useState<{ request: Promise<ServiceContainers | null>; failed: boolean }>()
  useEffect(() => {
    if (!pending) {
      setContainers(undefined)
      return
    }

    let active = true
    const complete = (result: ServiceContainers | null) => {
      if (!active) return
      if (result) setContainers(result)
      setSettled({ request: pending, failed: result === null })
    }
    void pending.then(complete, () => complete(null))
    return () => {
      active = false
    }
  }, [pending])
  return {
    containers: pending ? containers : undefined,
    loading: Boolean(pending && settled?.request !== pending),
    failed: Boolean(pending && settled?.request === pending && settled.failed)
  }
}

export const ServiceContainerLinksStatus = ({
  containers,
  loading,
  failed,
  refreshing,
  onRetry
}: ReturnType<typeof useServiceContainerLinks> & { refreshing: boolean; onRetry: () => void }) => {
  if (loading)
    return (
      <p
        role='status'
        className='text-sm text-foreground-muted'
      >
        Looking up Docker log links…
      </p>
    )
  if (!failed) return null

  return (
    <Notice
      tone='warning'
      title='Docker log links could not be loaded'
      description={containers ? 'Previously matched containers are still shown.' : undefined}
      actions={
        <MutationButton
          variant='ghost'
          pending={refreshing}
          pendingLabel='Retrying…'
          onClick={onRetry}
        >
          Try again
        </MutationButton>
      }
    />
  )
}
