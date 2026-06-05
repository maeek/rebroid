'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useActivityEventsController } from './use-activity-events-controller'
import type { ActivityEventsTableProps } from './activity-types'

type ActivityController = ReturnType<typeof useActivityEventsController>

type ActivityContextValue = ActivityEventsTableProps & {
  controller: ActivityController
}

const ActivityContext = createContext<ActivityContextValue | null>(null)

export const ActivityProvider = ({ children, value }: { children: ReactNode; value: ActivityEventsTableProps }) => {
  const controller = useActivityEventsController(value)

  return <ActivityContext.Provider value={{ ...value, controller }}>{children}</ActivityContext.Provider>
}

const useActivityContext = () => {
  const context = useContext(ActivityContext)
  if (!context) {
    throw new Error('Activity components must be rendered inside ActivityProvider.')
  }
  return context
}

export const useActivityController = () => useActivityContext().controller

export const useActivityData = () => {
  const { result, filters, sorting, facets, auditRetentionDays } = useActivityContext()
  return { result, filters, sorting, facets, auditRetentionDays }
}
