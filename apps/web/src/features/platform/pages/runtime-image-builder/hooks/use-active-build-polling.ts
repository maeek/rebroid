import { useEffect } from 'react'
import { getBff } from '@/lib/http/bff'
import { terminalBuildStatuses } from '../model/context-selection'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform-image-build'

export const useActiveBuildPolling = (
  activeJob: ContainerImageBuildJob | null,
  setActiveJob: (job: ContainerImageBuildJob) => void
) => {
  useEffect(() => {
    if (!activeJob || terminalBuildStatuses.includes(activeJob.status)) return
    const refresh = () => {
      void getBff<ContainerImageBuildJob>(`/api/bff/platform/image-builds/${encodeURIComponent(activeJob.id)}`)
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
