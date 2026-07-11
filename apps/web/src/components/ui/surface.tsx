import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const focusRingClassName =
  'focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-[3px] focus-visible:outline-none'

export const triggerResetClassName =
  'inline-flex items-center justify-center border-0 bg-transparent p-0 text-current transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50'

export const controlSurfaceClassName =
  'border border-control-border/80 bg-control text-foreground shadow-control supports-[backdrop-filter]:bg-control/58 supports-[backdrop-filter]:backdrop-blur-xl dark:supports-[backdrop-filter]:bg-control/78 oled:border-control-border/45 oled:supports-[backdrop-filter]:bg-control/92'

export const controlHoverClassName =
  'hover:border-control-border-strong/55 hover:bg-control-hover supports-[backdrop-filter]:hover:bg-control-hover/68 dark:supports-[backdrop-filter]:hover:bg-control-hover/86 oled:hover:border-control-border-strong/50 oled:supports-[backdrop-filter]:hover:bg-control-hover/92'

export const chipInputSurfaceClassName =
  'border border-control-border/80 bg-control text-foreground shadow-control transition-[background-color,border-color,box-shadow] supports-[backdrop-filter]:bg-control/58 supports-[backdrop-filter]:backdrop-blur-xl dark:supports-[backdrop-filter]:bg-control/78 oled:border-control-border/45 oled:supports-[backdrop-filter]:bg-control/92 focus-within:border-ring focus-within:ring-ring/35 focus-within:ring-[3px] hover:border-control-border-strong/55 hover:bg-control-hover supports-[backdrop-filter]:hover:bg-control-hover/68 dark:supports-[backdrop-filter]:hover:bg-control-hover/86 oled:hover:border-control-border-strong/50 oled:supports-[backdrop-filter]:hover:bg-control-hover/92'

export const floatingLayerClassName = 'z-[70]'
export const overlayClassName = 'bg-black/64 supports-[backdrop-filter]:backdrop-blur-[2px]'
export const interactiveItemClassName =
  'rounded-control outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50'

export const surfaceVariants = cva('border text-foreground', {
  variants: {
    level: {
      panel:
        'rounded-panel border-surface-border/55 bg-surface-panel/86 shadow-panel supports-[backdrop-filter]:bg-surface-panel/48 supports-[backdrop-filter]:backdrop-blur-md oled:border-surface-border/30 oled:bg-surface-panel/92 oled:supports-[backdrop-filter]:bg-surface-panel/84',
      band: 'rounded-panel border-surface-border/38 bg-surface-band/34 shadow-panel supports-[backdrop-filter]:bg-surface-band/24 supports-[backdrop-filter]:backdrop-blur-sm oled:border-surface-border/20 oled:bg-surface-band/72 oled:supports-[backdrop-filter]:bg-surface-band/58',
      floating:
        'rounded-overlay border-surface-border/80 bg-surface-elevated/96 shadow-floating supports-[backdrop-filter]:bg-surface-elevated/78 supports-[backdrop-filter]:backdrop-blur-2xl oled:border-surface-border/45 oled:bg-surface-elevated oled:supports-[backdrop-filter]:bg-surface-elevated/96',
      control: cn('rounded-control', controlSurfaceClassName)
    },
    tone: {
      neutral: '',
      info: 'border-info/35 bg-info/10 text-foreground',
      success: 'border-success/35 bg-success/10 text-foreground',
      warning: 'border-warning/35 bg-warning/10 text-foreground',
      danger: 'border-danger/40 bg-danger/10 text-danger'
    },
    interactive: {
      true: cn('transition-[background-color,border-color,box-shadow]', controlHoverClassName),
      false: ''
    }
  },
  defaultVariants: {
    tone: 'neutral',
    interactive: false
  }
})

export type SurfaceLevel = NonNullable<VariantProps<typeof surfaceVariants>['level']>
export type SurfaceTone = NonNullable<VariantProps<typeof surfaceVariants>['tone']>

export const Surface = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    Omit<VariantProps<typeof surfaceVariants>, 'level'> & {
      level: SurfaceLevel
    }
>(({ className, interactive, level, tone, ...props }, ref) => (
  <div
    ref={ref}
    data-level={level}
    data-tone={tone ?? 'neutral'}
    className={cn(surfaceVariants({ level, tone, interactive }), className)}
    {...props}
  />
))
Surface.displayName = 'Surface'

export const floatingSurfaceClassName = surfaceVariants({ level: 'floating' })
export const panelSurfaceClassName = surfaceVariants({ level: 'panel' })
export const bandSurfaceClassName = surfaceVariants({ level: 'band' })
