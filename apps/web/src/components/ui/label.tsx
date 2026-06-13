'use client'

import * as React from 'react'
import { Field as FieldPrimitive } from '@base-ui/react/field'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const labelVariants = cva('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70')

const Label = React.forwardRef<
  React.ElementRef<typeof FieldPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof FieldPrimitive.Label> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => {
  const renderLabel = () => (
    <FieldPrimitive.Label
      ref={ref}
      className={cn(labelVariants(), className)}
      {...props}
    />
  )

  return <FieldPrimitive.Root render={renderLabel} />
})
Label.displayName = 'Label'

export { Label }
