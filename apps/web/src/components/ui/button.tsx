import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { PrimitiveSlot } from '@/components/ui/primitive-slot'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control border text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger cursor-pointer",
  {
    variants: {
      variant: {
        primary: 'border-primary/30 bg-primary text-primary-foreground shadow-emphasis hover:bg-primary/90',
        danger: 'border-danger/30 bg-danger text-danger-foreground shadow-emphasis hover:bg-danger/88',
        outline: cn(controlSurfaceClassName, controlHoverClassName, 'hover:text-foreground'),
        secondary:
          'border-surface-border/70 bg-surface-band text-foreground shadow-control hover:bg-surface-band/86 hover:text-foreground',
        ghost: 'border-transparent shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/60',
        link: 'text-primary underline-offset-4 hover:underline border-none',
        bare: 'border-transparent bg-transparent p-0 text-current shadow-none hover:text-primary'
      },
      size: {
        md: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-control gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-control px-6 has-[>svg]:px-4',
        'icon-sm': 'size-8 p-0',
        'icon-md': 'size-9 p-0'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? PrimitiveSlot : 'button'

  return (
    <Comp
      data-slot='button'
      className={cn(focusRingClassName, buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
