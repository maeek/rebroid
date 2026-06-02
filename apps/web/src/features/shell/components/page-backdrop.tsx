'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BlurredImageBackdrop, type BlurredImageBackdropProps } from './blurred-image-backdrop'

type PageBackdropConfig = Pick<BlurredImageBackdropProps, 'imageSrc' | 'opacity' | 'fallbackBackground'>

type PageBackdropContextValue = {
  setBackdrop: (backdrop: PageBackdropConfig | null) => void
}

const PageBackdropContext = createContext<PageBackdropContextValue | null>(null)

export const PageBackdropProvider = ({
  children,
  defaultBackdrop
}: {
  children: ReactNode
  defaultBackdrop?: PageBackdropConfig
}) => {
  const [backdrop, setBackdrop] = useState<PageBackdropConfig | null>(null)

  const contextValue = useMemo<PageBackdropContextValue>(
    () => ({
      setBackdrop
    }),
    []
  )

  return (
    <PageBackdropContext.Provider value={contextValue}>
      <BlurredImageBackdrop
        {...defaultBackdrop}
        {...backdrop}
      />
      {children}
    </PageBackdropContext.Provider>
  )
}

const usePageBackdrop = (backdrop: PageBackdropConfig | null) => {
  const context = useContext(PageBackdropContext)

  useEffect(() => {
    if (!context) {
      return
    }

    context.setBackdrop(backdrop)

    return undefined
  }, [backdrop, context])

  useEffect(() => {
    if (!context) {
      return
    }

    return () => {
      context.setBackdrop(null)
    }
  }, [context])
}

export const PageBackdrop = ({ imageSrc, opacity, fallbackBackground }: PageBackdropConfig) => {
  const backdrop = useMemo(() => ({ imageSrc, opacity, fallbackBackground }), [fallbackBackground, imageSrc, opacity])

  usePageBackdrop(backdrop)
  return null
}
