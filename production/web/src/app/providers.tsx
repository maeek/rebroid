'use client'

import { PropsWithChildren, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { I18nextProvider } from 'react-i18next'
import { trpc } from '@/app/_trpc/client'
import i18nInstance from '@/lib/i18n/instance'

const Providers = ({ children, session }: PropsWithChildren<{ session: Session | null }>) => {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc'
        })
      ]
    })
  )

  return (
    <SessionProvider session={session}>
      <trpc.Provider
        client={trpcClient}
        queryClient={queryClient}
      >
        <QueryClientProvider client={queryClient}>
          <I18nextProvider
            i18n={i18nInstance}
            defaultNS='common'
          >
            {children}
          </I18nextProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  )
}

export default Providers
