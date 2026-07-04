'use client'

import { useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { RuntimeImagesSection } from './runtime-images-section'
import type { PlatformImagesGridPage, PlatformImagesGridQuery } from '@/server/orchestrator/platform/types'

export const RuntimeImagesPageClient = ({
  imagesPage,
  gridQuery
}: {
  imagesPage: PlatformImagesGridPage
  gridQuery: PlatformImagesGridQuery
}) => {
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = () => {
    setIsRefreshing(true)
    setRefreshKey(current => current + 1)
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Images'
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
        breadcrumbRoot={{ label: 'Runtime' }}
        titleActions={
          <div className='flex items-center gap-2'>
            <Button asChild>
              <Link href='/runtime/images/build'>
                <IconPlus className='size-4' />
                Build image
              </Link>
            </Button>
            <PlatformPageRefreshButton
              isRefreshing={isRefreshing}
              onRefresh={refresh}
            />
          </div>
        }
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <RuntimeImagesSection
          imagesPage={imagesPage}
          gridQuery={gridQuery}
          refreshKey={refreshKey}
          onRefreshComplete={() => setIsRefreshing(false)}
        />
      </section>
    </ProtectedStackPageLayout>
  )
}
