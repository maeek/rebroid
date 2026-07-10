import { useEffect } from 'react'
import { getImageBuildJobAction } from '@/server/orchestrator/platform/image-actions'
import { terminalBuildStatuses } from '../model/context-selection'
import type { ContainerImageBuildJob } from '@/server/orchestrator/platform/types'

export const useActiveBuildPolling = (
  activeJob: ContainerImageBuildJob | null,
  setActiveJob: (job: ContainerImageBuildJob) => void
) => {
  useEffect(() => {
    if (!activeJob || terminalBuildStatuses.includes(activeJob.status)) return
    const refresh = () => {
      void getImageBuildJobAction(activeJob.id)
        .then(setActiveJob)
        .catch(() => undefined)
    }
    let interval: number | null = null
    const stop = () => {
      if (interval !== null) window.clearInterval(interval)
      interval = null
    }
    const start = () => {
      stop()
      if (document.visibilityState !== 'visible') return
      interval = window.setInterval(refresh, 5000)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
      start()
    }
    const handleFocus = () => refresh()
    start()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [activeJob, setActiveJob])
}
