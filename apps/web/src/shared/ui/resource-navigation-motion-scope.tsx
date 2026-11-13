'use client'

import { createContext, useRef, type ReactNode, type RefObject } from 'react'

export const ResourceNavigationMotionContext = createContext<RefObject<Map<string, string>> | null>(null)

/** Keep the selected tab across section remounts within one resource. */
export const ResourceNavigationMotionScope = ({ children }: { children: ReactNode }) => {
  const selections = useRef(new Map<string, string>())
  return (
    <ResourceNavigationMotionContext.Provider value={selections}>{children}</ResourceNavigationMotionContext.Provider>
  )
}
