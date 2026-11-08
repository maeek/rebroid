import type { ComponentProps } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const ResourceLink = ({ className, ...props }: ComponentProps<typeof Link>) => (
  <Link
    className={cn(
      'rounded-control text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className
    )}
    {...props}
  />
)
