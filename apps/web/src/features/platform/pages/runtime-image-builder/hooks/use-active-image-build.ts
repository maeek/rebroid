import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { getBff, sendBff } from '@/lib/http/bff'
import { terminalBuildStatuses } from '../model/context-selection'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

const isLive = (job: ContainerImageBuildJob | null) => job !== null && !terminalBuildStatuses.includes(job.status)

const buildPath = (jobId: string) => `/api/bff/platform/image-builds/${encodeURIComponent(jobId)}`

export const useActiveImageBuild = (initialJob: ContainerImageBuildJob | null) => {
  const [activeJob, setActiveJob] = useState(initialJob)
  const currentJob = useRef(initialJob)
  const pending = useRef(false)
  const [mutation, setMutation] = useState<'start' | 'cancel' | null>(null)
  const jobId = activeJob?.id
  const isRunning = isLive(activeJob)

  const acceptSnapshot = useCallback((expectedId: string, next: ContainerImageBuildJob) => {
    const current = currentJob.current
    if (current?.id !== expectedId || next.id !== expectedId || !isLive(current)) return false
    currentJob.current = next
    setActiveJob(next)
    return true
  }, [])

  useEffect(() => {
    if (!jobId || !isRunning) return
    let disposed = false
    let refreshing = false
    const refresh = async () => {
      if (disposed || refreshing || document.visibilityState !== 'visible') return
      refreshing = true
      try {
        const next = await getBff<ContainerImageBuildJob>(buildPath(jobId))
        if (!disposed) acceptSnapshot(jobId, next)
      } catch {
        // Keep the last known state; the next refresh can recover from transient failures.
      } finally {
        refreshing = false
      }
    }
    let interval: number | null = null
    const stop = () => {
      if (interval !== null) window.clearInterval(interval)
      interval = null
    }
    const start = () => {
      stop()
      if (document.visibilityState !== 'visible') return
      interval = window.setInterval(() => void refresh(), 5000)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
      start()
    }
    const handleFocus = () => void refresh()
    start()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      disposed = true
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [jobId, isRunning, acceptSnapshot])

  const isIdle = () => !pending.current && !isLive(currentJob.current)

  const startBuild = async (request: () => Promise<ContainerImageBuildJob>, successTitle: string) => {
    if (!isIdle()) return
    pending.current = true
    setMutation('start')
    try {
      const job = await request()
      currentJob.current = job
      setActiveJob(job)
      toast({ title: successTitle, variant: 'success' })
    } catch (error) {
      toast({ title: 'Could not start build', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      pending.current = false
      setMutation(null)
    }
  }

  const cancelBuild = async () => {
    const job = currentJob.current
    if (pending.current || !job || !isLive(job)) return
    pending.current = true
    setMutation('cancel')
    try {
      const next = await sendBff<ContainerImageBuildJob>(`${buildPath(job.id)}/cancel`, {})
      if (acceptSnapshot(job.id, next) && next.status === 'cancelled') {
        toast({ title: 'Build cancelled', variant: 'success' })
      }
    } catch (error) {
      toast({ title: 'Could not cancel build', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      pending.current = false
      setMutation(null)
    }
  }

  return {
    activeJob,
    isIdle,
    isRunning,
    isStarting: mutation === 'start',
    isCancelling: mutation === 'cancel',
    startBuild,
    cancelBuild
  }
}
