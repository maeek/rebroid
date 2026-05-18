import { cn } from '@/lib/utils'

export const BlurredImageBackdrop = ({
  imageSrc,
  opacity = 0.05,
  fallbackBackground = 'radial-gradient(circle at top left, hsl(var(--primary) / 0.8), transparent 42%)',
  className
}: {
  imageSrc?: string | null
  opacity?: number
  fallbackBackground?: string
  className?: string
}) => {
  return (
    <div
      aria-hidden='true'
      className={cn('pointer-events-none fixed top-0 left-0 -z-10 h-screen w-screen bg-primary/80 blur-3xl', className)}
      style={{
        backgroundImage: imageSrc ? `url("${imageSrc}")` : fallbackBackground,
        backgroundSize: imageSrc ? '1000% 1000%' : '100% 100%',
        backgroundPosition: 'top left',
        opacity
      }}
    />
  )
}
