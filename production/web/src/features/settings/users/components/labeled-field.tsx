import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export const LabeledField = ({
  label,
  description,
  children,
  className
}: {
  label: string
  description?: string
  children: ReactNode
  className?: string
}) => (
  <div className={cn('grid gap-2', className)}>
    <span className='grid gap-1'>
      <Label>{label}</Label>
      <Visible when={description}>
        <span className='text-xs text-muted-foreground'>{description}</span>
      </Visible>
    </span>
    {children}
  </div>
)
