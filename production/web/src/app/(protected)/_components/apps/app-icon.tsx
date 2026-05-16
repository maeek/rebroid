'use client'

import { resolveAppIconUrl } from '@/lib/app-icons/url'
import { cn } from '@/lib/utils'

const squircleMask =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Cpath fill=%27black%27 d=%27M50 0C14 0 0 14 0 50s14 50 50 50 50-14 50-50S86 0 50 0Z%27/%3E%3C/svg%3E")'

export const AppIcon = ({
  appId: _appId,
  appName,
  icon,
  className
}: {
  appId: string
  appName: string
  icon?: string | null
  className?: string
}) => {
  const displayIcon = icon ?? null

  return (
    <div
      className={cn(
        'flex aspect-square items-center justify-center overflow-hidden rounded-[24%] bg-slate-400/20 text-sm font-semibold text-secondary-foreground transition-all',
        className
      )}
      style={{
        WebkitMaskImage: squircleMask,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskSize: '100% 100%',
        maskImage: squircleMask,
        maskRepeat: 'no-repeat',
        maskSize: '100% 100%',
        backgroundImage: displayIcon ? `url("${resolveAppIconUrl(displayIcon)}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {!displayIcon && appName.slice(0, 2).toUpperCase()}
    </div>
  )
}
