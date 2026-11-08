import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { getBff } from '@/lib/http/bff'
import { terminalBuildStatuses } from '../model/context-selection'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

export const useActiveBuildPolling = (
  activeJob: ContainerImageBuildJob | null,
  setActiveJob: Dispatch<SetStateAction<ContainerImageBuildJob | null>>
) => {
  const jobId = activeJob?.id
  const status = activeJob?.status
  useEffect(() => {
    if (!jobId || !status || terminalBuildStatuses.includes(status)) return
    let disposed = false
    let refreshing = false
    const refresh = async () => {
      if (disposed || refreshing || document.visibilityState !== 'visible') return
      refreshing = true
      try {
        const next = await getBff<ContainerImageBuildJob>(`/api/bff/platform/image-builds/${encodeURIComponent(jobId)}`)
        if (!disposed && next.id === jobId) {
          setActiveJob(current => {
            if (!current || current.id !== jobId || terminalBuildStatuses.includes(current.status)) return current
            return next
          })
        }
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
  }, [jobId, status, setActiveJob])
}
