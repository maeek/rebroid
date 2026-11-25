'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useContainerDetailController } from '@/features/platform/details/runtime-container-detail/use-container-detail-controller'
import type { PlatformContainerSummary } from '@/shared/contracts/platform'

type ContainerDetailContextValue = {
  controller: ReturnType<typeof useContainerDetailController>
  container: PlatformContainerSummary['container']
}

const ContainerDetailContext = createContext<ContainerDetailContextValue | null>(null)

export const ContainerDetailProvider = ({
  children,
  container
}: {
  children: ReactNode
  container: PlatformContainerSummary['container']
}) => {
  const controller = useContainerDetailController(container)

  return <ContainerDetailContext.Provider value={{ controller, container }}>{children}</ContainerDetailContext.Provider>
}

export const useContainerDetailContext = () => {
  const context = useContext(ContainerDetailContext)

  if (!context) {
    throw new Error('useContainerDetailContext must be used within ContainerDetailProvider')
  }

  return context
}

export const useContainerDetailControllerContext = () => useContainerDetailContext().controller
