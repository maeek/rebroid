'use client'

import { PropsWithChildren, Suspense, useLayoutEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname, useSearchParams } from 'next/navigation'
import { refreshBackLayersForRoute } from '@/lib/navigation/back-layers'

const BackLayerRouteSync = () => {
  const pathname = usePathname()
  const search = useSearchParams()

  useLayoutEffect(() => {
    refreshBackLayersForRoute()
  }, [pathname, search])

  return null
}

const Providers = ({ children }: PropsWithChildren) => {
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
    <QueryClientProvider client={queryClient}>
      {children}
      <Suspense fallback={null}>
        <BackLayerRouteSync />
      </Suspense>
    </QueryClientProvider>
  )
}

export default Providers
