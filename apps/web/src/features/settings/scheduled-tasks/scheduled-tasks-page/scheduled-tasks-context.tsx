'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useScheduledTasksController } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/use-scheduled-tasks-controller'
import type { ScheduledTasksPageProps } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'

type ScheduledTasksContextValue = ScheduledTasksPageProps & {
  controller: ReturnType<typeof useScheduledTasksController>
}

const ScheduledTasksContext = createContext<ScheduledTasksContextValue | null>(null)

export const ScheduledTasksProvider = ({
  children,
  value
}: {
  children: ReactNode
  value: ScheduledTasksPageProps
}) => {
  const controller = useScheduledTasksController(value)

  return <ScheduledTasksContext.Provider value={{ ...value, controller }}>{children}</ScheduledTasksContext.Provider>
}

export const useScheduledTasksContext = () => {
  const context = useContext(ScheduledTasksContext)

  if (!context) {
    throw new Error('useScheduledTasksContext must be used within ScheduledTasksProvider')
  }

  return context
}

export const useScheduledTasksControllerContext = () => useScheduledTasksContext().controller
