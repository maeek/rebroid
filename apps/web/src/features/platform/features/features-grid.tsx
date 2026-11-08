'use client'

import { useMemo, useState } from 'react'
import { IconInfoCircle, IconLoader2 } from '@tabler/icons-react'
import { Skeleton, SkeletonMask } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { FeatureAvailability, FeatureIdentity, FeatureManageLink } from './feature-grid-cells'
import { featureLabel } from './feature-presentation'
import { getEffectiveFeatureStatus } from './feature-status'
import type { FeatureFlagKey, FeatureFlagState } from '@/shared/contracts/feature-flags'
import type { ColumnDef } from '@tanstack/react-table'

export const FeaturesGrid = ({
  features,
  pendingKey,
  onUpdate,
  loading = false
}: {
  features: FeatureFlagState[]
  pendingKey: FeatureFlagKey | null
  onUpdate: (key: FeatureFlagKey, enabled: boolean) => Promise<void>
  loading?: boolean
}) => {
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const columns = useMemo<ColumnDef<FeatureFlagState>[]>(
    () => [
      {
        id: 'key',
        accessorFn: feature => featureLabel(feature.key),
        header: 'Feature',
        size: 320,
        meta: {
          label: 'Feature',
          skeleton: { kind: 'custom', render: index => <FeatureIdentity feature={features[index]} /> }
        },
        cell: ({ row: { original: feature } }) => <FeatureIdentity feature={feature} />
      },
      {
        id: 'enabled',
        accessorFn: feature => feature.enabled,
        sortDescFirst: false,
        header: 'Enabled',
        size: 136,
        enableHiding: false,
        meta: {
          label: 'Enabled',
          skeleton: {
            kind: 'custom',
            render: index => (
              <div className='grid gap-1'>
                <Skeleton className='h-5 w-9 rounded-full' />
                {features[index]?.mutable === false ? (
                  <span className='text-xs text-foreground-muted'>Deployment managed</span>
                ) : null}
              </div>
            )
          }
        },
        cell: ({ row: { original: feature } }) => (
          <div className='grid gap-1'>
            <div className='flex items-center gap-2'>
              <Switch
                checked={feature.enabled}
                disabled={!feature.mutable || !feature.supported || pendingKey !== null}
                aria-busy={pendingKey === feature.key || undefined}
                aria-label={`${feature.enabled ? 'Disable' : 'Enable'} ${featureLabel(feature.key)}`}
                onCheckedChange={enabled => void onUpdate(feature.key, enabled)}
              />
              <span className='size-4 shrink-0'>
                {pendingKey === feature.key ? (
                  <IconLoader2
                    className='size-4 animate-spin text-primary'
                    aria-label={`Applying ${featureLabel(feature.key)}`}
                  />
                ) : null}
              </span>
            </div>
            {!feature.mutable ? <span className='text-xs text-foreground-muted'>Deployment managed</span> : null}
          </div>
        )
      },
      {
        id: 'effectiveStatus',
        accessorFn: feature => getEffectiveFeatureStatus(feature).label,
        enableSorting: false,
        size: 280,
        header: () => (
          <span className='inline-flex items-center gap-1.5'>
            Availability
            <Tooltip>
              <TooltipTrigger aria-label='About feature availability'>
                <IconInfoCircle className='size-4 text-foreground-muted' />
              </TooltipTrigger>
              <TooltipContent className='max-w-72'>
                Enabled is the requested setting. Availability shows whether the owning service has applied it. Feature
                changes are saved immediately.
              </TooltipContent>
            </Tooltip>
          </span>
        ),
        meta: {
          label: 'Availability',
          skeleton: {
            kind: 'custom',
            render: index => (
              <FeatureAvailability
                feature={features[index]}
                loading
              />
            )
          }
        },
        cell: ({ row: { original: feature } }) => <FeatureAvailability feature={feature} />
      },
      {
        id: 'manage',
        header: 'Manage',
        size: 208,
        minSize: 208,
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: {
          label: 'Manage',
          skeleton: {
            kind: 'custom',
            render: index => {
              const feature = features[index]
              return feature ? (
                <SkeletonMask>
                  <FeatureManageLink feature={feature} />
                </SkeletonMask>
              ) : (
                <Skeleton className='h-8 w-28' />
              )
            }
          }
        },
        cell: ({ row: { original: feature } }) => <FeatureManageLink feature={feature} />
      }
    ],
    [features, onUpdate, pendingKey]
  )
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return features.filter(feature =>
      [
        featureLabel(feature.key),
        feature.key,
        feature.description,
        feature.enabled ? 'enabled' : 'disabled',
        feature.mutable ? 'runtime' : 'deployment',
        getEffectiveFeatureStatus(feature).label
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [features, search])
  return (
    <DataGridWorkspace
      search={searchDraft}
      searchPlaceholder='Search features'
      onSearchChange={setSearchDraft}
      onSearch={setSearch}
      disabled={loading}
    >
      <DataGrid
        columns={columns}
        data={visible}
        totalItems={visible.length}
        pageIndex={0}
        pageSize={Math.max(visible.length, 1)}
        getRowId={feature => feature.key}
        minWidth='59rem'
        loading={loading ? { rowCount: features.length || 4, selectable: false, rowMenu: false } : false}
        emptyState={<div className='text-center text-foreground-muted'>No features match your search.</div>}
      />
    </DataGridWorkspace>
  )
}
