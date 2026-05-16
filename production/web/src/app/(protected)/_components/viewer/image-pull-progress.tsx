import { cn } from '@/lib/utils'

const PULL_PROGRESS_PATTERN =
  /^(.+?)(?:\s+\[[^\]]*\])?\s+(\d+(?:\.\d+)?)([kmgt]?b)\/(\d+(?:\.\d+)?)([kmgt]?b)(?:\s+([a-z0-9:_-]+))?$/i

const SIZE_MULTIPLIERS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4
}

const formatUnit = (unit: string) => unit.trim().toUpperCase()

const toBytes = (value: number, unit: string) => {
  const normalizedUnit = unit.trim().toLowerCase()
  const multiplier = SIZE_MULTIPLIERS[normalizedUnit]

  if (!multiplier) {
    return Number.NaN
  }

  return value * multiplier
}

export const parseImagePullProgress = (statusMessage?: string | null) => {
  if (!statusMessage) {
    return null
  }

  const match = statusMessage.trim().match(PULL_PROGRESS_PATTERN)

  if (!match) {
    return null
  }

  const [, status, currentRaw, currentUnit, totalRaw, totalUnit, layerId] = match

  const currentValue = Number(currentRaw)
  const totalValue = Number(totalRaw)
  const currentBytes = toBytes(currentValue, currentUnit)
  const totalBytes = toBytes(totalValue, totalUnit)

  if (!Number.isFinite(currentBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    return null
  }

  return {
    status: status.trim(),
    current: `${currentRaw} ${formatUnit(currentUnit)}`,
    total: `${totalRaw} ${formatUnit(totalUnit)}`,
    layerId: layerId?.trim(),
    percent: Math.min(100, Math.max(0, (currentBytes / totalBytes) * 100))
  }
}

export const ImagePullProgress = ({
  statusMessage,
  isImagePulling,
  className,
  textClassName,
  barClassName
}: {
  statusMessage?: string | null
  isImagePulling?: boolean
  className?: string
  textClassName?: string
  barClassName?: string
}) => {
  if (!statusMessage) {
    return null
  }

  const progress = isImagePulling ? parseImagePullProgress(statusMessage) : null

  if (!progress) {
    return <span className={cn('text-secondary-foreground text-sm', textClassName)}>{statusMessage}</span>
  }

  const progressLabel = `${progress.current} / ${progress.total}${progress.layerId ? ` (${progress.layerId})` : ''}`

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
        <span className={cn('text-sm text-foreground', textClassName)}>{progress.status}</span>
        <span className='text-sm text-secondary-foreground'>{progressLabel}</span>
      </div>
      <div
        aria-label={`${progress.status}: ${progressLabel}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(progress.percent)}
        className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-primary/15', barClassName)}
        role='progressbar'
      >
        <div
          className='h-full rounded-full bg-primary transition-[width] duration-300 ease-out'
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}
