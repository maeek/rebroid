'use client'

import { useMemo } from 'react'
import { RuntimeContainersSection } from './runtime-containers-section'
import { createContainerColumns } from './runtime-containers-table-parts'
import { RuntimeInventoryLoadingSection } from './runtime-inventory-loading-section'
import { RuntimeInventoryPage, useInventoryRefresh } from './runtime-inventory-page'
import type { PlatformContainersGridPage, PlatformContainersGridQuery } from '@/shared/contracts/platform'

export const RuntimeContainersPageClient = ({
  containersPage,
  gridQuery
}: {
  containersPage: PlatformContainersGridPage
  gridQuery: PlatformContainersGridQuery
}) => {
  const refresh = useInventoryRefresh(containersPage)

  return (
    <RuntimeInventoryPage
      resource='containers'
      refresh={refresh}
    >
      <RuntimeContainersSection
        containersPage={containersPage}
        gridQuery={gridQuery}
      />
    </RuntimeInventoryPage>
  )
}

export const RuntimeContainersPageLoading = () => {
  const columns = useMemo(() => createContainerColumns(), [])
  return (
    <RuntimeInventoryPage resource='containers'>
      <RuntimeInventoryLoadingSection
        actionLabels={['Stop selected', 'Remove selected']}
        columns={columns}
        searchPlaceholder='Search containers'
      />
    </RuntimeInventoryPage>
  )
}
