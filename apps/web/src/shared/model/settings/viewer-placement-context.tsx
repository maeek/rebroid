'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { viewerPlacementCookie, type ViewerPlacement } from './viewer-placement'

const defaultViewerPlacement: ViewerPlacement = 'top'

const ViewerPlacementContext = createContext<{
  placement: ViewerPlacement
  setPlacement: (placement: ViewerPlacement) => void
}>({
  placement: defaultViewerPlacement,
  setPlacement: () => {}
})

const savePlacement = (placement: ViewerPlacement) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${viewerPlacementCookie}=${placement}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

export const ViewerPlacementProvider = ({
  initialPlacement,
  children
}: {
  initialPlacement?: ViewerPlacement
  children: ReactNode
}) => {
  const [placement, setPlacement] = useState<ViewerPlacement>(initialPlacement ?? defaultViewerPlacement)

  return (
    <ViewerPlacementContext.Provider
      value={{
        placement,
        setPlacement: next => {
          savePlacement(next)
          setPlacement(next)
        }
      }}
    >
      {children}
    </ViewerPlacementContext.Provider>
  )
}

export const useViewerPlacement = () => useContext(ViewerPlacementContext)
