import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const focusRingClassName =
  'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none'

export const triggerResetClassName =
  'inline-flex items-center justify-center border-0 bg-transparent p-0 text-current transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50'

export const controlSurfaceClassName = 'border border-control-border/35 bg-control text-foreground shadow-none'

export const controlHoverClassName = 'hover:border-control-border-strong/50 hover:bg-control-hover'

export const chipInputSurfaceClassName =
  'border border-control-border/35 bg-control text-foreground shadow-none transition-colors focus-within:border-ring focus-within:ring-ring/40 focus-within:ring-2 hover:border-control-border-strong/50 hover:bg-control-hover'

export const floatingLayerClassName = 'z-[70]'
export const overlayClassName = 'bg-black/40'
const interactiveItemStateClassName =
  'touch-control outline-none transition-colors data-[highlighted]:bg-control-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
const selectableItemStateClassName =
  'aria-selected:bg-primary/14 aria-checked:bg-primary/14 aria-selected:data-[highlighted]:bg-primary/22 aria-checked:data-[highlighted]:bg-primary/22'

export const selectableItemClassName = cn(
  interactiveItemStateClassName,
  'rounded-control',
  selectableItemStateClassName
)

export const semanticToneClassNames = {
  neutral: '',
  info: 'data-[tone=info]:!border-info/45 data-[tone=info]:!bg-info/14 data-[tone=info]:text-foreground',
  success:
    'data-[tone=success]:!border-success/45 data-[tone=success]:!bg-success/14 data-[tone=success]:text-foreground',
  warning:
    'data-[tone=warning]:!border-warning/45 data-[tone=warning]:!bg-warning/14 data-[tone=warning]:text-foreground',
  danger: 'data-[tone=danger]:!border-danger/45 data-[tone=danger]:!bg-danger/14 data-[tone=danger]:text-danger'
} as const

export const surfaceVariants = cva('border text-foreground', {
  variants: {
    level: {
      panel: 'rounded-panel border-transparent bg-surface-editor shadow-none',
      band: 'rounded-panel border-transparent bg-surface-editor shadow-none',
      floating: 'rounded-overlay border-surface-border/30 bg-surface-elevated shadow-floating',
      control: cn('rounded-control', controlSurfaceClassName)
    },
    tone: {
      neutral: semanticToneClassNames.neutral,
      info: semanticToneClassNames.info,
      success: semanticToneClassNames.success,
      warning: semanticToneClassNames.warning,
      danger: semanticToneClassNames.danger
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
export const dialogSurfaceClassName = cn(floatingSurfaceClassName, 'bg-surface-dialog')
export const menuSurfaceClassName = cn(floatingSurfaceClassName, 'border-surface-border/80')
export const actionMenuSurfaceClassName =
  'min-w-48 rounded-menu border border-surface-border/60 bg-surface-menu/92 p-1 text-foreground shadow-floating'
export const actionMenuItemClassName = cn(
  interactiveItemStateClassName,
  'gap-2 rounded-sm px-2.5 py-1.5 text-xs/4 touch:text-sm/5'
)
export const selectableActionMenuItemClassName = cn(actionMenuItemClassName, selectableItemStateClassName)
export const panelSurfaceClassName = surfaceVariants({ level: 'panel' })
export const bandSurfaceClassName = surfaceVariants({ level: 'band' })

export const editorSectionClassName = cn(panelSurfaceClassName, 'border-0 p-6 max-sm:p-4')
