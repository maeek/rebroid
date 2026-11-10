'use client'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

const RadioOption = <Value,>({ children, className, ...props }: Radio.Root.Props<Value>) => (
  <Radio.Root
    className={cn(
      'group flex min-h-9 min-w-0 cursor-pointer items-center gap-3 rounded-control px-2 text-sm transition-colors hover:bg-control-hover data-[checked]:bg-primary/10 data-[checked]:hover:bg-primary/15 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 touch:min-h-11',
      focusRingClassName,
      className
    )}
    {...props}
  >
    <span
      aria-hidden='true'
      className='grid size-4 shrink-0 place-items-center rounded-full border border-control-border-strong/65 bg-control group-data-[checked]:border-primary'
    >
      <Radio.Indicator className='size-2 rounded-full border-4 border-primary' />
    </span>
    {children}
  </Radio.Root>
)

export { RadioGroup, RadioOption }
