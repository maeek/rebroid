'use client'

import { cn } from '@/lib/utils'
import { resolveAppIconUrl } from '@/shared/model/media/image-url'
import { appIconSquircleStyle } from '@/shared/ui/app-icon/app-icon-shape'
import { getHslColorFromCharCode, getHslColorFromCharCodeForeground } from '@/utils/hsl-from-text'

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
        'flex aspect-square items-center justify-center overflow-hidden rounded-[24%] bg-surface-band/70 text-sm font-medium text-foreground-muted transition-all',
        className
      )}
      style={{
        ...appIconSquircleStyle,
        color: displayIcon ? undefined : getHslColorFromCharCodeForeground(appName),
        backgroundColor: displayIcon ? undefined : getHslColorFromCharCode(appName),
        backgroundImage: displayIcon ? `url("${resolveAppIconUrl(displayIcon)}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {!displayIcon && appName.slice(0, 3).toUpperCase()}
    </div>
  )
}
