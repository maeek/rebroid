import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const protectedPageMaxWidthClassName = 'max-w-[90rem]'

export const ProtectedSplitPageLayout = ({
  children,
  className,
  mainClassName
}: {
  children: ReactNode
  className?: string
  mainClassName?: string
}) => {
  return (
    <div className={cn('pl-72 max-lg:pl-0 min-h-full h-[calc(100vh-4rem)] max-sm:w-full', className)}>
      <main
        className={cn(
          'row-layout mx-auto flex h-full w-full justify-between gap-8 max-sm:flex-col max-sm:items-center',
          protectedPageMaxWidthClassName,
          mainClassName
        )}
      >
        {children}
      </main>
    </div>
  )
}

export const ProtectedStackPageLayout = ({
  children,
  className,
  mainClassName
}: {
  children: ReactNode
  className?: string
  mainClassName?: string
}) => {
  return (
    <div className={cn('pl-72 max-lg:pl-0 min-h-full max-sm:w-full', className)}>
      <main className={cn('row-layout mx-auto flex w-full flex-col', protectedPageMaxWidthClassName, mainClassName)}>
        {children}
      </main>
    </div>
  )
}

export const ProtectedSplitPageContent = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <div className={cn('px-6 w-full flex items-start gap-4 pt-2 pb-2 max-sm:px-4 flex-col', className)}>{children}</div>
  )
}
