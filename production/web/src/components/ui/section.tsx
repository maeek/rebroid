import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Section = ({ className, children }: { className?: string; children?: ReactNode }) => {
  return (
    <div
      className={cn(
        'flex flex-col bg-card/60 p-6 max-sm:p-4 w-full rounded-xl hover:bg-card/50 border border-input',
        className
      )}
    >
      {children}
    </div>
  )
}
