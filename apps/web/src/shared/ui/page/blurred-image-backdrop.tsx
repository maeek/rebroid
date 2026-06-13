'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type BlurredImageBackdropProps = {
  imageSrc?: string | null
  opacity?: number
  fallbackBackground?: string
  className?: string
}

type BackdropLayer = Required<Pick<BlurredImageBackdropProps, 'fallbackBackground' | 'opacity'>> & {
  imageSrc?: string | null
}

const defaultFallbackBackground = 'hsl(var(--primary) / 0.045)'

const toLayer = ({
  imageSrc,
  opacity = 0.08,
  fallbackBackground = defaultFallbackBackground
}: BlurredImageBackdropProps): BackdropLayer => ({
  imageSrc,
  opacity,
  fallbackBackground
})

const isSameLayer = (left: BackdropLayer, right: BackdropLayer) => {
  return (
    left.imageSrc === right.imageSrc &&
    left.opacity === right.opacity &&
    left.fallbackBackground === right.fallbackBackground
  )
}

export const BlurredImageBackdrop = ({
  imageSrc,
  opacity = 0.08,
  fallbackBackground = defaultFallbackBackground,
  className
}: BlurredImageBackdropProps) => {
  const targetLayer = useMemo(
    () => toLayer({ imageSrc, opacity, fallbackBackground }),
    [fallbackBackground, imageSrc, opacity]
  )
  const [layers, setLayers] = useState<[BackdropLayer, BackdropLayer]>([targetLayer, targetLayer])
  const [activeIndex, setActiveIndex] = useState(0)
  const activeLayer = layers[activeIndex]

  useEffect(() => {
    if (isSameLayer(activeLayer, targetLayer)) {
      return
    }

    const nextIndex = activeIndex === 0 ? 1 : 0
    setLayers(
      current =>
        current.map((layer, index) => (index === nextIndex ? targetLayer : layer)) as [BackdropLayer, BackdropLayer]
    )

    const animationFrame = window.requestAnimationFrame(() => {
      setActiveIndex(nextIndex)
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [activeIndex, activeLayer, targetLayer])

  return (
    <div
      aria-hidden='true'
      className='pointer-events-none fixed inset-0 z-0 isolate overflow-hidden oled:hidden'
    >
      {layers.map((layer, index) => {
        const hasImage = Boolean(layer.imageSrc)

        return (
          <div
            key={index}
            className={cn(
              'absolute inset-0 transition-opacity duration-200 ease-out will-change-opacity',
              hasImage && 'bg-primary/80 blur-3xl',
              className
            )}
            style={{
              background: hasImage ? undefined : layer.fallbackBackground,
              backgroundImage: hasImage ? `url("${layer.imageSrc}")` : undefined,
              backgroundSize: hasImage ? '1000% 1000%' : undefined,
              backgroundRepeat: hasImage ? 'no-repeat' : undefined,
              backgroundPosition: hasImage ? 'top left' : undefined,
              opacity: index === activeIndex ? (hasImage ? layer.opacity : 1) : 0
            }}
          />
        )
      })}
    </div>
  )
}
