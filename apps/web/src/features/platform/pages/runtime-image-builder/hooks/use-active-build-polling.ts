import { useEffect } from 'react'
import { getImageBuildJobAction } from '@/server/orchestrator/platform/image-actions'
import type { ContainerImageBuildJob } from '@/server/orchestrator/platform/types'
import { terminalBuildStatuses } from '../model/context-selection'

export const useActiveBuildPolling = (
  activeJob: ContainerImageBuildJob | null,
  setActiveJob: (job: ContainerImageBuildJob) => void
) => {
  useEffect(() => {
    if (!activeJob || terminalBuildStatuses.includes(activeJob.status)) return
    const interval = window.setInterval(() => {
      void getImageBuildJobAction(activeJob.id)
        .then(setActiveJob)
        .catch(() => undefined)
    }, 1800)
    return () => window.clearInterval(interval)
  }, [activeJob, setActiveJob])
}
