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
  <div className='mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pt-3 sm:px-6 sm:pt-4'>
    <AuthHeader originalLogo={originalLogo} />
    <main className={cn('flex flex-1 items-start py-8 sm:py-12', intro && 'lg:pt-[clamp(4rem,10vh,8rem)]')}>
      <div
        className={cn(
          'mx-auto grid w-full max-w-md',
          intro && 'gap-8 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-12'
        )}
      >
        {intro ? (
          <>
            {intro}
            <div className='min-w-0'>{children}</div>
          </>
        ) : (
          children
        )}
      </div>
    </main>
  </div>
)
