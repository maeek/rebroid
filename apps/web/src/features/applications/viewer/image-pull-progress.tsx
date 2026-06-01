import { cn } from '@/lib/utils'
import type { AndroidImagePullProgress } from '@/server/orchestrator/applications/types'

export const ImagePullProgress = ({
  statusMessage,
  progress,
  className,
  textClassName,
  barClassName
}: {
  statusMessage?: string | null
  progress?: AndroidImagePullProgress | null
  className?: string
  textClassName?: string
  barClassName?: string
}) => {
  if (!statusMessage) {
    return null
  }

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
