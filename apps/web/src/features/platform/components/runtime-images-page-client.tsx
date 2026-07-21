'use client'

import { useMemo, useTransition, type ReactNode } from 'react'
import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { RuntimeImagesSection } from './runtime-images-section'
import { createImageColumns } from './runtime-images-table-parts'
import { RuntimeInventoryLoadingSection } from './runtime-inventory-loading-section'
import type { PlatformImagesGridPage, PlatformImagesGridQuery } from '@/shared/contracts/platform'

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
}) => {
  const { isFeatureEnabled } = useFeatureFlags()
  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Runtime' }}
        title='Images'
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
        actions={
          <div className='flex items-center gap-2'>
            {isFeatureEnabled('feature.image-builder') && (
              <Button asChild>
                <Link href='/runtime/images/build'>
                  <IconPlus className='size-4' />
                  Build image
                </Link>
              </Button>
            )}
            <PlatformPageRefreshButton
              disabled={loading}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          </div>
        }
      />
      <PageContent>{children}</PageContent>
    </StandardPage>
  )
}

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
