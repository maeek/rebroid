'use client'

import { useMemo } from 'react'
import { RuntimeInventoryLoadingSection } from './runtime-inventory-loading-section'
import { RuntimeInventoryPage, useInventoryRefresh } from './runtime-inventory-page'
import { RuntimeNetworksSection } from './runtime-networks-section'
import { createNetworkColumns } from './runtime-networks-table-parts'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/shared/contracts/platform'

export const RuntimeNetworksPageClient = ({
  networksPage,
  gridQuery
}: {
  networksPage: PlatformNetworksGridPage
  gridQuery: PlatformNetworksGridQuery
}) => {
  const refresh = useInventoryRefresh(networksPage)

  return (
    <RuntimeInventoryPage
      resource='networks'
      refresh={refresh}
    >
      <RuntimeNetworksSection
        networksPage={networksPage}
        gridQuery={gridQuery}
      />
    </RuntimeInventoryPage>
  )
}

export const RuntimeNetworksPageLoading = () => {
  const columns = useMemo(() => createNetworkColumns(), [])
  return (
    <RuntimeInventoryPage resource='networks'>
      <RuntimeInventoryLoadingSection
        actionLabels={['Remove selected']}
        columns={columns}
        searchPlaceholder='Search networks'
      />
    </RuntimeInventoryPage>
  )
}
