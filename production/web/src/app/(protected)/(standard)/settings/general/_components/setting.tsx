import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  vertical: 'flex-col items-start w-full',
  horizontal: 'flex-row items-center justify-between'
} as const

export const Setting = ({
  label,
  children,
  variant = 'horizontal',
  className
}: {
  label: string
  children: ReactNode
  className?: string
  variant?: keyof typeof variants
}) => {
  return (
    <label>
      <div className={cn('flex items-center justify-between gap-4', className)}>
        <div className={cn(variants[variant])}>{label}</div>
        <div className={cn(variants[variant])}>{children}</div>
      </div>
    </label>
  )
}
