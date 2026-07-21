'use client'

import { useMemo, useState } from 'react'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { useContainerDetailContext } from '@/features/platform/details/runtime-container-detail/container-detail-context'
import {
  getRelatedImageSize,
  getRelatedImageTags
} from '@/features/platform/details/runtime-container-detail/container-detail-utils'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { DefinitionTable } from '@/shared/ui/definition-table'
import { formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import type { PlatformNetwork } from '@/shared/contracts/platform'
import type { ColumnDef } from '@tanstack/react-table'

export const RelatedImageSection = () => {
  const { details } = useContainerDetailContext()
  const relatedImage = details.relatedImage

  return (
    <Section
      title='Related image'
      surface='plain'
      contentClassName='gap-3'
    >
      <Visible when={relatedImage}>
        <>
          <DefinitionTable
            items={[
              { label: 'Tags', value: getRelatedImageTags(relatedImage) },
              { label: 'Size', value: getRelatedImageSize(relatedImage) },
              { label: 'Created', value: formatPlatformDate(relatedImage?.createdAt ?? null) }
            ]}
          />
        </>
      </Visible>
      <Visible when={!relatedImage}>
        <p className='text-sm text-foreground-muted'>The related image is no longer present locally.</p>
      </Visible>
    </Section>
  )
}

export const RelatedNetworksSection = () => {
  const { details } = useContainerDetailContext()
  const networks = details.relatedNetworks
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const visibleNetworks = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return networks
    return networks.filter(network =>
      `${network.name} ${network.id} ${network.subnets.join(' ')}`.toLowerCase().includes(query)
    )
  }, [networks, search])
  const columns = useMemo<ColumnDef<PlatformNetwork>[]>(
    () => [
      {
        id: 'name',
        accessorFn: network => network.name,
        header: 'Name',
        size: 280,
        meta: { label: 'Name', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>
      },
      {
        id: 'driver',
        accessorFn: network => network.driver,
        header: 'Driver',
        size: 140,
        meta: { label: 'Driver', skeleton: { kind: 'text' } },
        cell: ({ row }) => <span className='text-foreground-muted'>{row.original.driver}</span>
      },
      {
        id: 'subnet',
        header: 'Subnet',
        size: 280,
        meta: { label: 'Subnet', skeleton: { kind: 'text' } },
        cell: ({ row }) => (
          <span className='text-foreground-muted'>
            {row.original.subnets.length > 0 ? row.original.subnets.join(', ') : 'none'}
          </span>
        )
      }
    ],
    []
  )

  return (
    <Section
      surface='plain'
      title='Related networks'
      contentClassName='gap-3'
    >
      <Visible when={networks.length > 0}>
        <DataGridWorkspace
          search={searchDraft}
          searchPlaceholder='Search related networks'
          onSearchChange={setSearchDraft}
          onSearch={setSearch}
        >
          <DataGrid
            columns={columns}
            data={visibleNetworks}
            totalItems={visibleNetworks.length}
            pageIndex={0}
            pageSize={Math.max(visibleNetworks.length, 1)}
            getRowId={network => network.id}
            minWidth='44rem'
            emptyState={<div className='text-center text-foreground-muted'>No related networks match this search.</div>}
          />
        </DataGridWorkspace>
      </Visible>
      <Visible when={networks.length === 0}>
        <p className='text-sm text-foreground-muted'>No related networks were found for this container.</p>
      </Visible>
    </Section>
  )
}
