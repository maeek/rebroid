import type { ReactNode } from 'react'
import { Surface } from '@/components/ui/surface'

export const AuthPanel = ({
  children,
  title,
  description
}: {
  children: ReactNode
  title: string
  description?: ReactNode
}) => (
  <Surface
    level='panel'
    className='grid min-w-0 gap-6 p-6 sm:gap-8 sm:p-8'
  >
    <div className='grid gap-1'>
      <h1 className='text-2xl font-medium tracking-tight sm:text-3xl'>{title}</h1>
      {description ? <div className='text-sm text-foreground-muted'>{description}</div> : null}
    </div>
    {children}
  </Surface>
)
