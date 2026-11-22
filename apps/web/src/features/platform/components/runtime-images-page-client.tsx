'use client'

import { useMemo, type ReactNode } from 'react'
import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { RuntimeImagePullForm } from './runtime-image-pull-form'
import { RuntimeImagesSection } from './runtime-images-section'
import { createImageColumns } from './runtime-images-table-parts'
import { RuntimeInventoryLoadingSection } from './runtime-inventory-loading-section'
import { RuntimeInventoryPage, useInventoryRefresh } from './runtime-inventory-page'
import type { PlatformImagesGridPage, PlatformImagesGridQuery } from '@/shared/contracts/platform'

export const RuntimeImagesPageClient = ({
  imagesPage,
  gridQuery
}: {
  imagesPage: PlatformImagesGridPage
  gridQuery: PlatformImagesGridQuery
}) => {
  const refresh = useInventoryRefresh(imagesPage)

  return (
    <RuntimeImagesPage refresh={refresh}>
      <RuntimeImagePullForm onPulled={refresh.onRefresh} />
      <RuntimeImagesSection
        imagesPage={imagesPage}
        gridQuery={gridQuery}
      />
    </RuntimeImagesPage>
  )
}

const RuntimeImagesPage = ({
  refresh,
  children
}: {
  refresh?: ReturnType<typeof useInventoryRefresh>
  children: ReactNode
}) => {
  const { isFeatureEnabled } = useFeatureFlags()
  return (
    <RuntimeInventoryPage
      resource='images'
      refresh={refresh}
      actions={
        isFeatureEnabled('feature.image-builder') && (
          <Button asChild>
            <Link href='/runtime/images/build'>
              <IconPlus className='size-4' />
              Build image
            </Link>
          </Button>
        )
      }
    >
      {children}
    </RuntimeInventoryPage>
  )
}

export const RuntimeImagesPageLoading = () => {
  const columns = useMemo(() => createImageColumns(), [])
  return (
    <RuntimeImagesPage>
      <RuntimeImagePullForm loading />
      <RuntimeInventoryLoadingSection
        actionLabels={['Remove selected']}
        columns={columns}
        searchPlaceholder='Search images'
      />
    </RuntimeImagesPage>
  )
}
