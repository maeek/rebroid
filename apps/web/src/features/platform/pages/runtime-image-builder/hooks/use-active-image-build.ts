import { useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { useVisibilityAwareInterval } from '@/hooks/use-visibility-aware-interval'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { getBff, sendBff } from '@/lib/http/bff'
import { saveOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { terminalBuildStatuses } from '../model/context-selection'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

const isLive = (job: ContainerImageBuildJob | null) => job !== null && !terminalBuildStatuses.includes(job.status)

const buildPath = (jobId: string) => `/api/bff/platform/image-builds/${encodeURIComponent(jobId)}`

export const useActiveImageBuild = (initialJob: ContainerImageBuildJob | null) => {
  const [activeJob, setActiveJob] = useState(initialJob)
  const currentJob = useRef(initialJob)
  const pending = useRef(false)
  const [mutation, setMutation] = useState<'start' | 'cancel' | null>(null)
  const [isSettingDefault, setIsSettingDefault] = useState(false)
  const jobId = activeJob?.id
  const isRunning = isLive(activeJob)

  const acceptSnapshot = (expectedId: string, next: ContainerImageBuildJob) => {
    const current = currentJob.current
    if (current?.id !== expectedId || next.id !== expectedId || !isLive(current)) return false
    currentJob.current = next
    setActiveJob(next)
    return true
  }

  useVisibilityAwareInterval({
    enabled: isRunning,
    intervalMs: 5000,
    task: async signal => {
      if (!jobId) return
      const next = await getBff<ContainerImageBuildJob>(buildPath(jobId), signal)
      if (!signal.aborted) acceptSnapshot(jobId, next)
    }
  })

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

  const setAsDefault = async () => {
    if (!activeJob || activeJob.status !== 'succeeded' || isSettingDefault) return
    setIsSettingDefault(true)
    try {
      await saveOrchestratorUiSettings({ defaultContainerImage: activeJob.targetImage })
      toast({ title: 'Default image updated', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not update default image',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSettingDefault(false)
    }
  }

  return {
    activeJob,
    isIdle,
    isRunning,
    isStarting: mutation === 'start',
    isCancelling: mutation === 'cancel',
    isSettingDefault,
    startBuild,
    cancelBuild,
    setAsDefault
  }
}
