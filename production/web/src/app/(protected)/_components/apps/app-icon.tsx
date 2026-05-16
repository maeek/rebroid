'use client'

import { resolveAppIconUrl } from '@/lib/app-icons/url'
import { cn } from '@/lib/utils'

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
        'bg-slate-400/20 flex items-center justify-center transition-all overflow-hidden text-sm font-semibold text-secondary-foreground',
        className
      )}
      style={{
        clipPath: `url(#squircleClip)`,
        backgroundImage: displayIcon ? `url("${resolveAppIconUrl(displayIcon)}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {!displayIcon && appName.slice(0, 2).toUpperCase()}
    </div>
  )
}
