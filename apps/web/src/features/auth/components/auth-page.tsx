import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AuthHeader } from './auth-header'

export const AuthPage = ({
  children,
  intro,
  originalLogo
}: {
  children: ReactNode
  intro?: ReactNode
  originalLogo?: boolean
}) => (
  <div className='flex min-h-dvh flex-col bg-background'>
    <AuthHeader originalLogo={originalLogo} />
    <main className='flex flex-1 items-start px-4 py-8 sm:items-center sm:px-6 sm:py-12'>
      <div
        className={cn(
          'mx-auto grid w-full max-w-md gap-8',
          intro && 'lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-16'
        )}
      >
        {children}
        {intro ? <div className='lg:order-first'>{intro}</div> : null}
      </div>
    </main>
  </div>
)
