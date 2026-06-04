'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useContainerDetailController } from '@/features/orchestrator/details/orchestrator-container-detail/use-container-detail-controller'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/server/orchestrator/platform/types'

type ContainerDetailContextValue = {
  controller: ReturnType<typeof useContainerDetailController>
  details: PlatformContainerDetails
}

const ContainerDetailContext = createContext<ContainerDetailContextValue | null>(null)

export const ContainerDetailProvider = ({
  children,
  details,
  initialLogs
}: {
  children: ReactNode
  details: PlatformContainerDetails
  initialLogs: PlatformContainerLog
}) => {
  const controller = useContainerDetailController({ container: details.container, initialLogs })

  return <ContainerDetailContext.Provider value={{ controller, details }}>{children}</ContainerDetailContext.Provider>
}

export const useContainerDetailContext = () => {
  const context = useContext(ContainerDetailContext)

  if (!context) {
    throw new Error('useContainerDetailContext must be used within ContainerDetailProvider')
  }

  return context
}

export const useContainerDetailControllerContext = () => useContainerDetailContext().controller
