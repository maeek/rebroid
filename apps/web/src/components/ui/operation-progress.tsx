import { cn } from '@/lib/utils'
import styles from './action-motion.module.css'

export const OperationProgress = ({
  value,
  label,
  active = true,
  className
}: {
  value: number | null
  label: string
  active?: boolean
  className?: string
}) => {
  const percent = value !== null && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null
  return (
    <div
      role={active ? 'progressbar' : undefined}
      aria-hidden={!active || undefined}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-valuetext={percent === null ? 'In progress' : undefined}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-surface-band transition-opacity duration-150 motion-reduce:transition-none',
        !active && 'opacity-0',
        className
      )}
    >
      {percent !== null ? (
        <div
          className={cn('h-full w-full rounded-full bg-primary', styles.progress)}
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      ) : null}
    </div>
  )
}
