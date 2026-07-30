'use client'

import { useCallback, useMemo, useState } from 'react'
import { IconAdjustments, IconInfoCircle, IconLoader2 } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { updateFeatureFlagsAction } from '@/server/orchestrator/settings/actions'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'
import type { ColumnDef } from '@tanstack/react-table'

type FeatureRow = FeatureFlagManifest['features'][number]

export type EffectiveFeatureStatus = {
  label:
    | 'Unavailable'
    | 'Sync failed'
    | 'Restart required'
    | 'Waiting for display service'
    | 'Off'
    | 'Active'
    | 'Applying'
  tone: StatusBadgeTone
  description: string
}

export const getEffectiveFeatureStatus = (feature: FeatureRow): EffectiveFeatureStatus => {
  if (!feature.supported) {
    return { label: 'Unavailable', tone: 'danger', description: 'This deployment does not support the feature.' }
  }
  if (feature.syncStatus === 'failed') {
    return { label: 'Sync failed', tone: 'danger', description: 'The configured state could not reach its owner.' }
  }
  if (feature.syncStatus === 'restart_required') {
    return {
      label: 'Restart required',
      tone: 'warning',
      description: 'A service restart is required to apply this state.'
    }
  }
  if (feature.owner === 'display' && feature.syncStatus === 'pending') {
    return {
      label: 'Waiting for display service',
      tone: 'warning',
      description: 'The configuration is saved and is waiting for the display service to acknowledge it.'
    }
  }
  if (!feature.enabled) {
    return { label: 'Off', tone: 'neutral', description: 'The feature is configured off.' }
  }
  if (feature.effective) {
    return { label: 'Active', tone: 'success', description: 'The configured state is active.' }
  }
  return { label: 'Applying', tone: 'info', description: 'The configured state is still being applied.' }
}

const createFeatureColumns = ({
  pendingKey,
  updateFeature
}: {
  pendingKey: FeatureRow['key'] | null
  updateFeature: (key: FeatureRow['key'], enabled: boolean) => Promise<void>
}): ColumnDef<FeatureRow>[] => [
  {
    accessorKey: 'key',
    header: 'Feature',
    meta: { label: 'Feature', skeleton: { kind: 'stacked' } },
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
    id: 'configuration',
    accessorFn: feature => (feature.enabled ? 'on' : 'off'),
    header: 'Configuration',
    meta: { label: 'Configuration', skeleton: { kind: 'stacked' } },
    enableHiding: false,
    size: 280,
    cell: ({ row }) => (
      <div className='flex items-center justify-between gap-4'>
        <div className='grid gap-0.5'>
          <span className='text-sm font-medium'>{row.original.enabled ? 'On' : 'Off'}</span>
          <span className='text-xs text-foreground-muted'>
            {row.original.mutable ? 'Runtime setting' : 'Managed by deployment'}
          </span>
        </div>
        {pendingKey === row.original.key ? (
          <IconLoader2
            className='size-4 animate-spin text-primary'
            aria-label={`Applying ${row.original.key}`}
          />
        ) : null}
        <Switch
          checked={row.original.enabled}
          disabled={!row.original.mutable || !row.original.supported || pendingKey !== null}
          aria-busy={pendingKey === row.original.key || undefined}
          aria-label={`Enable ${row.original.key}`}
          onCheckedChange={enabled => void updateFeature(row.original.key, enabled)}
        />
      </div>
    )
  },
  {
    id: 'effectiveStatus',
    accessorFn: feature => getEffectiveFeatureStatus(feature).label,
    enableSorting: false,
    header: () => (
      <span className='inline-flex items-center gap-1.5'>
        Effective status
        <Tooltip>
          <TooltipTrigger aria-label='About effective feature status'>
            <IconInfoCircle className='size-4 text-foreground-muted' />
          </TooltipTrigger>
          <TooltipContent className='max-w-72'>
            Configuration is the requested state. Effective status shows whether the owning service is actually
            enforcing it.
          </TooltipContent>
        </Tooltip>
      </span>
    ),
    meta: { label: 'Effective status', skeleton: { kind: 'stacked' } },
    size: 280,
    cell: ({ row }) => {
      const status = getEffectiveFeatureStatus(row.original)
      return (
        <div className='grid gap-1'>
          <StatusBadge
            tone={status.tone}
            className='w-fit'
          >
            {status.label}
          </StatusBadge>
          <span className='text-xs leading-5 text-foreground-muted'>{status.description}</span>
        </div>
      )
    }
  }
]

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

  const columns = useMemo(() => createFeatureColumns({ pendingKey, updateFeature }), [pendingKey, updateFeature])

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
        getEffectiveFeatureStatus(feature).label
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
              minWidth='52rem'
              emptyState={<div className='text-center text-foreground-muted'>No feature flags match your search.</div>}
            />
          </DataGridWorkspace>
        </Section>
      </PageContent>
    </StandardPage>
  )
}

export const FeaturesPageLoading = () => {
  const columns = createFeatureColumns({ pendingKey: null, updateFeature: () => Promise.resolve() })

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Platform', href: '/platform' }}
        title='Features'
        description='Enable or disable platform capabilities without restarting the deployment.'
        meta={<Skeleton className='h-4 w-36' />}
      />
      <PageContent>
        <Section
          surface='plain'
          contentClassName='gap-4'
        >
          <DataGridWorkspace
            search=''
            searchPlaceholder='Search features'
            onSearchChange={() => undefined}
            onSearch={() => undefined}
            disabled
          >
            <DataGrid
              columns={columns}
              data={[] as FeatureRow[]}
              loading={{ rowCount: 4, selectable: false, rowMenu: false }}
              totalItems={0}
              pageIndex={0}
              pageSize={4}
              getRowId={feature => feature.key}
              minWidth='52rem'
            />
          </DataGridWorkspace>
        </Section>
      </PageContent>
    </StandardPage>
  )
}
