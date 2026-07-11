import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

function Skeleton({
  as: Component = 'div',
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'div' | 'span' }) {
  return (
    <Component
      aria-hidden='true'
      className={cn('rounded-control bg-control/60 motion-safe:animate-pulse', className)}
      {...props}
    />
  )
}

function SkeletonMask({
  children,
  className,
  visible = true
}: {
  children: ReactNode
  className?: string
  visible?: boolean
}) {
  return (
    <span
      aria-busy={visible || undefined}
      className={cn('relative inline-grid min-w-0', className)}
    >
      <span
        aria-hidden={visible || undefined}
        className={cn('min-w-0', visible && 'invisible')}
      >
        {children}
      </span>
      {visible ? (
        <Skeleton
          as='span'
          className='absolute inset-0 size-full'
        />
      ) : null}
    </span>
  )
}

export { Skeleton, SkeletonMask }
