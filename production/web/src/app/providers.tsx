'use client'

import { PropsWithChildren, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { I18nextProvider } from 'react-i18next'
import i18nInstance from '@/lib/i18n/instance'

const Providers = ({ children, session }: PropsWithChildren<{ session: Session | null }>) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 5 * 60 * 1000,
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
            retry: 2,
            staleTime: 2000
          }
        }
      })
  )

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider
          i18n={i18nInstance}
          defaultNS='common'
        >
          {children}
        </I18nextProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}

export default Providers
