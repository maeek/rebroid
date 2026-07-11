'use client'

import { useMemo, useTransition, type ReactNode } from 'react'
import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { createImageColumns, RuntimeImagesSection } from './runtime-images-section'
import { RuntimeInventoryLoadingSection } from './runtime-inventory-loading-section'
import type { PlatformImagesGridPage, PlatformImagesGridQuery } from '@/server/orchestrator/platform/types'

export const RuntimeImagesPageClient = ({
  imagesPage,
  gridQuery
}: {
  imagesPage: PlatformImagesGridPage
  gridQuery: PlatformImagesGridQuery
}) => {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  const refresh = () => startRefresh(() => router.refresh())

  return (
    <RuntimeImagesPageFrame
      isRefreshing={isRefreshing}
      onRefresh={refresh}
    >
      <RuntimeImagesSection
        imagesPage={imagesPage}
        gridQuery={gridQuery}
      />
    </RuntimeImagesPageFrame>
  )
}

const RuntimeImagesPageFrame = ({
  children,
  isRefreshing = false,
  loading = false,
  onRefresh
}: {
  children: ReactNode
  isRefreshing?: boolean
  loading?: boolean
  onRefresh: () => void
}) => (
  <StandardPage className='gap-2'>
    <PlatformPageHeader
      title='Images'
      description='Local images available to application containers, custom runtimes, and platform sidecars.'
      breadcrumbRoot={{ label: 'Runtime' }}
      actions={
        <div className='flex items-center gap-2'>
          <Button asChild>
            <Link href='/runtime/images/build'>
              <IconPlus className='size-4' />
              Build image
            </Link>
          </Button>
          <PlatformPageRefreshButton
            disabled={loading}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh}
          />
        </div>
      }
    />
    <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>{children}</section>
  </StandardPage>
)

export const RuntimeImagesPageLoading = () => {
  const columns = useMemo(() => createImageColumns(), [])
  return (
    <RuntimeImagesPageFrame
      loading
      onRefresh={() => undefined}
    >
      <RuntimeInventoryLoadingSection
        actionLabels={['Remove selected']}
        columns={columns}
        searchPlaceholder='Search images'
      />
    </RuntimeImagesPageFrame>
  )
}
