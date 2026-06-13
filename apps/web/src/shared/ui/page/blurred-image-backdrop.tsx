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

const defaultFallbackBackground = 'radial-gradient(circle at top left, hsl(var(--primary) / 0.8), transparent 42%)'

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
      {layers.map((layer, index) => (
        <div
          key={index}
          className={cn(
            'absolute inset-0 bg-primary/80 blur-3xl transition-opacity duration-200 ease-out will-change-opacity',
            className
          )}
          style={{
            backgroundImage: layer.imageSrc ? `url("${layer.imageSrc}")` : layer.fallbackBackground,
            backgroundSize: layer.imageSrc ? '1000% 1000%' : '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'top left',
            opacity: index === activeIndex ? layer.opacity : 0
          }}
        />
      ))}
    </div>
  )
}
