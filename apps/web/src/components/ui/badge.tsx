import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-control border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        neutral: 'border-surface-border/60 bg-surface-band/65 text-foreground',
        info: 'border-info/30 bg-info/12 text-info',
        danger: 'border-transparent bg-danger text-danger-foreground shadow hover:bg-danger/80',
        warning: 'border-warning/35 bg-warning/14 text-warning hover:bg-warning/22',
        outline: 'text-foreground',
        success: 'border-success/30 bg-success/12 text-success hover:bg-success/20'
      }
    },
    defaultVariants: {
      variant: 'neutral'
    }
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge }
