import type { ComponentProps } from 'react'
import { Section } from '@/components/ui/section'
import { editorSectionClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

export const PlatformResourceSection = ({ className, ...props }: ComponentProps<typeof Section>) => (
  <Section
    {...props}
    className={cn(editorSectionClassName, className)}
  />
)
