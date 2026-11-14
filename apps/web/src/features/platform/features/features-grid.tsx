'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { IconInfoCircle } from '@tabler/icons-react'
import { MutationSwitch } from '@/components/ui/mutation-switch'
import { Skeleton, SkeletonMask } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { FeatureAvailability, FeatureIdentity, FeatureManageLink } from './feature-grid-cells'
import { featureLabel, orderFeaturesForDisplay } from './feature-presentation'
import { getEffectiveFeatureStatus } from './feature-status'
import type { FeatureFlagKey, FeatureFlagState } from '@/shared/contracts/feature-flags'
import type { CellContext, ColumnDef } from '@tanstack/react-table'

type FeatureSwitchActions = {
  pendingKey: string | null
  savedKey?: string | null
  onUpdate: (key: FeatureFlagKey, enabled: boolean) => Promise<void>
}
const FeatureSwitchContext = createContext<FeatureSwitchActions | null>(null)
const FeatureEnabledCell = ({ row: { original: feature } }: CellContext<FeatureFlagState, unknown>) => {
  const context = useContext(FeatureSwitchContext)
  if (!context) throw new Error('Feature switches require their grid context.')
  const { pendingKey, savedKey, onUpdate } = context
  return (
    <div className='grid gap-1'>
      <div className='flex items-center gap-2'>
        <MutationSwitch
          checked={feature.enabled}
          disabled={!feature.mutable || !feature.supported || pendingKey !== null}
          pending={pendingKey === feature.key}
          success={savedKey === feature.key}
          aria-label={`${feature.enabled ? 'Disable' : 'Enable'} ${featureLabel(feature.key)}`}
          onCheckedChange={enabled => void onUpdate(feature.key, enabled)}
        />
      </div>
      {!feature.mutable ? <span className='text-xs text-foreground-muted'>Deployment managed</span> : null}
    </div>
  )
}

export const FeaturesGrid = ({
  features: manifestFeatures,
  pendingKey,
  savedKey,
  onUpdate,
  loading = false
}: {
  features: FeatureFlagState[]
  pendingKey: string | null
  savedKey?: string | null
  onUpdate: (key: FeatureFlagKey, enabled: boolean) => Promise<void>
  loading?: boolean
}) => {
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const features = useMemo(() => orderFeaturesForDisplay(manifestFeatures), [manifestFeatures])
  const columns = useMemo<ColumnDef<FeatureFlagState>[]>(
    () => [
      {
        id: 'key',
        accessorFn: feature => featureLabel(feature.key),
        header: 'Feature',
        size: 440,
        meta: {
          label: 'Feature',
          skeleton: {
            kind: 'custom',
            render: index => (
              <FeatureIdentity
                feature={features[index]}
                loading
              />
            )
          }
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
        cell: FeatureEnabledCell
      },
      {
        id: 'effectiveStatus',
        accessorFn: feature => getEffectiveFeatureStatus(feature).label,
        enableSorting: false,
        size: 512,
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
    [features]
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
    <FeatureSwitchContext.Provider value={{ pendingKey, savedKey, onUpdate }}>
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
          emptyState={
            <DataGridEmptyState
              title='No features available'
              description='Platform capabilities will appear here when they are available.'
            />
          }
        />
      </DataGridWorkspace>
    </FeatureSwitchContext.Provider>
  )
}
