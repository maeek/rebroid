'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getBff } from '@/lib/http/bff'
import { pullPlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { ActionResultError, type ActionError } from '@/shared/actions/action-result'
import { unconfirmedImagePull } from './runtime-image-pull-notice'
import type { PlatformImagePull } from '@/shared/contracts/platform'

const phaseLabels = {
  queued: 'Waiting for Docker…',
  'contacting-registry': 'Contacting registry…',
  'transferring-layers': 'Downloading and extracting layers…',
  registering: 'Registering image locally…',
  pulled: 'Image pulled',
  failed: 'Image pull failed'
} satisfies Record<PlatformImagePull['phase'], string>

const failedPull: ActionError = {
  code: 'upstream_error',
  message: 'Check the image reference and registry access, then try again.',
  requestId: ''
}

export const useRuntimeImagePull = (onPulled: () => void) => {
  const [job, setJob] = useState<PlatformImagePull | null>(null)
  const [starting, setStarting] = useState(false)
  const [stale, setStale] = useState(false)
  const [failure, setFailure] = useState<ActionError | null>(null)
  const inFlight = useRef(false)

  const complete = useEffectEvent((result: PlatformImagePull) => {
    setJob(null)
    inFlight.current = false
    if (result.phase === 'failed') {
      setFailure(failedPull)
      return
    }
    toast({ title: 'Image pulled', description: result.image, variant: 'success' })
    onPulled()
  })

  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    const watch = new AbortController()
    let timeout: number | undefined
    const poll = async () => {
      try {
        const result = await getBff<PlatformImagePull>(
          `/api/bff/platform/image-pulls/${encodeURIComponent(jobId)}`,
          watch.signal
        )
        if (watch.signal.aborted) return
        setStale(false)
        if (result.phase === 'pulled' || result.phase === 'failed') {
          complete(result)
          return
        }
        setJob(result)
      } catch (error) {
        if (watch.signal.aborted) return
        if (
          error instanceof ActionResultError &&
          ['not_found', 'unauthenticated', 'forbidden'].includes(error.failure.code)
        ) {
          setFailure({ ...unconfirmedImagePull, requestId: error.failure.requestId })
          setJob(null)
          inFlight.current = false
          return
        }
        setStale(true)
      }
      timeout = window.setTimeout(() => void poll(), 1500)
    }
    void poll()
    return () => {
      watch.abort()
      window.clearTimeout(timeout)
    }
  }, [jobId])

  const start = async (registry: string, draft: string) => {
    if (inFlight.current) return
    inFlight.current = true
    setFailure(null)
    setStarting(true)
    setStale(false)
    try {
      const result = await pullPlatformImageAction(registry, draft)
      if (result.ok) setJob(result.data)
      else {
        setFailure(result.error)
        inFlight.current = false
      }
    } catch {
      setFailure(unconfirmedImagePull)
      inFlight.current = false
    } finally {
      setStarting(false)
    }
  }

  return {
    start,
    failure,
    clearFailure: () => setFailure(null),
    pending: starting || job !== null,
    status: job ? phaseLabels[job.phase] : 'Submitting pull request…',
    stale
  }
}
