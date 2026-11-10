import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const NumericUnitInput = ({ unit, className, ...props }: ComponentProps<typeof Input> & { unit: string }) => (
  <div className='flex w-full max-w-72 items-center gap-3'>
    <Input
      {...props}
      className={cn('min-w-0 max-w-48', className)}
    />
    <span className='shrink-0 text-sm text-foreground-muted touch:text-base/6'>{unit}</span>
  </div>
)
