'use client'

import { useCallback, useMemo, useState } from 'react'
import { IconAdjustments } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Section } from '@/components/ui/section'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { updateFeatureFlagsAction } from '@/server/orchestrator/settings/actions'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'
import type { ColumnDef } from '@tanstack/react-table'

type FeatureRow = FeatureFlagManifest['features'][number]

const syncStatusLabels = {
  applied: 'Applied',
  pending: 'Pending',
  restart_required: 'Restart required',
  failed: 'Failed'
} satisfies Record<FeatureRow['syncStatus'], string>

const syncStatusTones = {
  applied: 'success',
  pending: 'warning',
  restart_required: 'warning',
  failed: 'danger'
} satisfies Record<FeatureRow['syncStatus'], StatusBadgeTone>

export const FeaturesPage = ({ initialManifest }: { initialManifest: FeatureFlagManifest }) => {
  const router = useRouter()
  const [manifest, setManifest] = useState(initialManifest)
  const [pendingKey, setPendingKey] = useState<FeatureRow['key'] | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')

  const updateFeature = useCallback(
    async (key: FeatureRow['key'], enabled: boolean) => {
      setPendingKey(key)
      try {
        const updated = await updateFeatureFlagsAction({ revision: manifest.revision, changes: [{ key, enabled }] })
        setManifest(updated)
        router.refresh()
        toast({ title: `${key} ${enabled ? 'enabled' : 'disabled'}`, variant: 'success' })
      } catch (error) {
        toast({
          title: 'Could not update feature',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        })
      } finally {
        setPendingKey(null)
      }
    },
    [manifest.revision, router]
  )

  const columns = useMemo<ColumnDef<FeatureRow>[]>(
    () => [
      {
        accessorKey: 'key',
        header: 'Feature',
        meta: { label: 'Feature' },
        size: 380,
        cell: ({ row }) => (
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary'>
              <IconAdjustments className='size-5' />
            </div>
            <div className='min-w-0'>
              <div className='truncate font-medium text-foreground'>{row.original.key}</div>
              <div className='mt-1 truncate text-xs text-foreground-muted'>{row.original.description}</div>
            </div>
          </div>
        )
      },
      {
        id: 'state',
        accessorFn: feature => (feature.enabled ? 'enabled' : 'disabled'),
        header: 'State',
        meta: { label: 'State' },
        size: 128,
        cell: ({ row }) => (
          <StatusBadge tone={row.original.enabled ? 'success' : 'neutral'}>
            {row.original.enabled ? 'Enabled' : 'Disabled'}
          </StatusBadge>
        )
      },
      {
        accessorKey: 'control',
        header: 'Control',
        meta: { label: 'Control' },
        size: 144,
        cell: ({ row }) => (
          <StatusBadge tone={row.original.mutable ? 'info' : 'neutral'}>
            {row.original.mutable ? 'Runtime' : 'Deployment'}
          </StatusBadge>
        )
      },
      {
        id: 'availability',
        accessorFn: feature => (feature.supported ? 'supported' : 'unavailable'),
        header: 'Availability',
        meta: { label: 'Availability' },
        size: 160,
        cell: ({ row }) => (
          <StatusBadge tone={row.original.supported ? 'success' : 'danger'}>
            {row.original.supported ? 'Supported' : 'Unavailable'}
          </StatusBadge>
        )
      },
      {
        accessorKey: 'syncStatus',
        header: 'Synchronization',
        meta: { label: 'Synchronization' },
        size: 176,
        cell: ({ row }) => (
          <StatusBadge tone={syncStatusTones[row.original.syncStatus]}>
            {syncStatusLabels[row.original.syncStatus]}
          </StatusBadge>
        )
      },
      {
        id: 'actions',
        header: '',
        meta: { label: 'Enabled' },
        enableHiding: false,
        enableSorting: false,
        enableResizing: false,
        size: 112,
        cell: ({ row }) => (
          <div className='flex justify-end'>
            <Switch
              checked={row.original.enabled}
              disabled={!row.original.mutable || !row.original.supported || pendingKey !== null}
              aria-busy={pendingKey === row.original.key || undefined}
              aria-label={`Enable ${row.original.key}`}
              onCheckedChange={enabled => void updateFeature(row.original.key, enabled)}
            />
          </div>
        )
      }
    ],
    [pendingKey, updateFeature]
  )

  const visibleFeatures = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return manifest.features

    return manifest.features.filter(feature => {
      const searchText = [
        feature.key,
        feature.description,
        feature.enabled ? 'enabled' : 'disabled',
        feature.mutable ? 'runtime' : 'deployment',
        feature.supported ? 'supported' : 'unavailable',
        syncStatusLabels[feature.syncStatus]
      ]
        .join(' ')
        .toLowerCase()
      return searchText.includes(query)
    })
  }, [manifest.features, search])

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Platform', href: '/platform' }}
        title='Features'
        description='Enable or disable platform capabilities without restarting the deployment.'
        meta={<span>Configuration revision {manifest.revision}</span>}
      />
      <PageContent>
        <Section
          surface='plain'
          contentClassName='gap-4'
        >
          <DataGridWorkspace
            search={searchDraft}
            searchPlaceholder='Search features'
            onSearchChange={setSearchDraft}
            onSearch={setSearch}
          >
            <DataGrid
              columns={columns}
              data={visibleFeatures}
              totalItems={visibleFeatures.length}
              pageIndex={0}
              pageSize={Math.max(visibleFeatures.length, 1)}
              getRowId={feature => feature.key}
              minWidth='69rem'
              emptyState={<div className='text-center text-foreground-muted'>No feature flags match your search.</div>}
            />
          </DataGridWorkspace>
        </Section>
      </PageContent>
    </StandardPage>
  )
}
