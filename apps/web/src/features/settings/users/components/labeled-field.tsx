import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export const LabeledField = ({
  label,
  description,
  children,
  className,
  required
}: {
  label: string
  description?: string
  children: ReactNode
  className?: string
  required?: boolean
}) => (
  <div className={cn('grid gap-2', className)}>
    <span className='grid gap-1.5'>
      <Label>
        {label}
        <Visible when={required}>
          <span className='ml-1 text-xs font-medium text-muted-foreground'>* (Required)</span>
        </Visible>
      </Label>
      <Visible when={description}>
        <span className='text-xs text-muted-foreground'>{description}</span>
      </Visible>
    </span>
    {children}
  </div>
)
