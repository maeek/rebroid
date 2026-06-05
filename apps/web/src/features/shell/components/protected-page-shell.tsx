import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const protectedPageMaxWidthClassName = 'max-w-[120rem]'

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
    <div className={cn('min-h-full pl-72 max-lg:pl-0 max-sm:w-full lg:h-[calc(100dvh-4rem)]', className)}>
      <main
        className={cn(
          'row-layout mx-auto flex min-h-[calc(100dvh-4rem)] w-full justify-between gap-8 max-lg:flex-col max-lg:items-center',
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
    <div className={cn('flex w-full flex-col items-start gap-4 px-6 pb-2 pt-2 max-sm:px-4', className)}>{children}</div>
  )
}
