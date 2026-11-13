import { OperationProgress } from '@/components/ui/operation-progress'
import { cn } from '@/lib/utils'
import type { AndroidImagePullProgress } from '@/shared/contracts/application'

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
    return <span className={cn('text-foreground-muted text-sm', textClassName)}>{statusMessage}</span>
  }

  const progressLabel = `${progress.current} / ${progress.total}${progress.layerId ? ` (${progress.layerId})` : ''}`

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
        <span className={cn('text-sm text-foreground', textClassName)}>{progress.status}</span>
        <span className='text-sm text-foreground-muted'>{progressLabel}</span>
      </div>
      <OperationProgress
        label={`${progress.status}: ${progressLabel}`}
        value={progress.percent}
        className={barClassName}
      />
    </div>
  )
}
