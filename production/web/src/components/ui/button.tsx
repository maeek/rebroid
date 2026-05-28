import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer backdrop-blur-xs",
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-primary/80 text-primary-foreground hover:bg-primary/92',
        destructive: 'border-destructive/25 bg-destructive/65 text-foreground hover:bg-destructive/78',
        outline:
          'border-border/70 bg-background/55 hover:bg-accent/70 hover:text-accent-foreground dark:bg-card/35 dark:hover:bg-card/55',
        secondary:
          'border-border/70 bg-secondary/72 text-secondary-foreground hover:bg-secondary/86 hover:text-foreground',
        input: 'border-border/70 bg-input/72 text-foreground hover:bg-input/88',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline border-none',
        update: 'border-green-500/20 bg-green-500/22 text-foreground underline-offset-4 hover:bg-green-500/30'
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
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
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
