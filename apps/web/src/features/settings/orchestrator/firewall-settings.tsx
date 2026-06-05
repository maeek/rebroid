'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconShieldCheck } from '@tabler/icons-react'
import Link from 'next/link'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { PlatformStatusBanner } from '@/features/orchestrator/components/platform-status-banner'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  reconcileNetworkPoliciesAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { ServiceHealth } from '@/server/orchestrator/diagnostics/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const visibleCidrCount = 3

const sortApplications = (applications: AndroidApplication[], sorting: SortingState) => {
  const activeSorting = sorting.length > 0 ? sorting : [{ id: 'name', desc: false }]
  return [...applications].sort((left, right) => {
    for (const item of activeSorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'name') result = left.name.localeCompare(right.name)
      else if (item.id === 'runtime') result = left.status.currentStatus.localeCompare(right.status.currentStatus)
      else if (item.id === 'result') {
        result = (left.network.policy.result?.code ?? left.network.policy.status ?? '').localeCompare(
          right.network.policy.result?.code ?? right.network.policy.status ?? ''
        )
      } else if (item.id === 'restricted') {
        result = Number(left.network.policy.enabled) - Number(right.network.policy.enabled)
      }
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}

const AllowlistBadges = ({ cidrs }: { cidrs: string[] }) => {
  if (cidrs.length === 0) return <span className='text-sm text-secondary-foreground'>No custom CIDRs</span>
  return (
    <div className='flex max-w-[24rem] flex-wrap gap-1'>
      {cidrs.slice(0, visibleCidrCount).map(cidr => (
        <Badge
          key={cidr}
          variant='secondary'
        >
          {cidr}
        </Badge>
      ))}
      <Visible when={cidrs.length > visibleCidrCount}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant='outline'>+{cidrs.length - visibleCidrCount}</Badge>
          </TooltipTrigger>
          <TooltipContent className='max-w-sm break-all'>{cidrs.slice(visibleCidrCount).join(', ')}</TooltipContent>
        </Tooltip>
      </Visible>
    </div>
  )
}

export const FirewallSettings = ({
  initialHealth,
  initialApplications,
  refreshKey = 0,
  onRefreshComplete
}: {
  initialHealth: ServiceHealth
  initialApplications: AndroidApplication[]
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const [applications, setApplications] = useState(initialApplications)
  const [health, setHealth] = useState(initialHealth)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const filteredApplications = useMemo(() => {
    const query = submittedSearch.trim().toLowerCase()
    if (!query) return applications
    return applications.filter(application =>
      [
        application.id,
        application.name,
        application.status.currentStatus,
        application.network.policy.status,
        ...application.network.policy.allowCidrs
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [applications, submittedSearch])
  const sortedApplications = useMemo(
    () => sortApplications(filteredApplications, sorting),
    [filteredApplications, sorting]
  )
  const paginatedApplications = useMemo(
    () => sortedApplications.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [pageIndex, pageSize, sortedApplications]
  )
  const selectedApplications = sortedApplications.filter(application => selectedIds.has(application.id))

  useEffect(() => setPageIndex(0), [submittedSearch])
  useEffect(() => {
    const pageCount = Math.max(Math.ceil(sortedApplications.length / pageSize), 1)
    if (pageIndex >= pageCount) setPageIndex(pageCount - 1)
  }, [pageIndex, pageSize, sortedApplications.length])
  useEffect(() => {
    const visibleIds = new Set(sortedApplications.map(application => application.id))
    setSelectedIds(current => new Set(Array.from(current).filter(id => visibleIds.has(id))))
  }, [sortedApplications])

  const replaceApplication = useCallback(
    (application: AndroidApplication) =>
      setApplications(current => current.map(item => (item.id === application.id ? application : item))),
    []
  )

  const refresh = useCallback(async () => {
    setBusy('refresh')
    try {
      const [nextHealth, nextApplications] = await Promise.all([
        getOrchestratorHealthAction(),
        listApplicationsAction()
      ])
      setHealth(nextHealth.services.firewall)
      setApplications(nextApplications)
    } catch (error) {
      toast({
        title: 'Could not load network access policies',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
      onRefreshComplete?.()
    }
  }, [onRefreshComplete])

  useEffect(() => {
    if (refreshKey > 0) {
      void refresh()
    }
  }, [refresh, refreshKey])

  const setRestricted = useCallback(
    async (application: AndroidApplication, enabled: boolean) => {
      setBusy(application.id)
      try {
        replaceApplication(await updateNetworkPolicyAction(application.id, { networkPolicyEnabled: enabled }))
        toast({ title: enabled ? 'Restricted network access enabled' : 'Unrestricted network access enabled' })
      } catch (error) {
        toast({
          title: 'Could not update network access policy',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive'
        })
      } finally {
        setBusy(null)
      }
    },
    [replaceApplication]
  )

  const reconcileSelected = async () => {
    const targets = selectedApplications
    setBusy('reconcile')
    try {
      if (targets.length === 0) {
        await reconcileNetworkPoliciesAction()
        await refresh()
        toast({ title: 'Network access rules reconciled and stale rules pruned' })
        return
      }
      const updated = await Promise.all(targets.map(application => applyNetworkPolicyAction(application.id)))
      const updatedById = new Map(updated.map(application => [application.id, application]))
      setApplications(current => current.map(application => updatedById.get(application.id) ?? application))
      setSelectedIds(new Set())
      toast({ title: 'Selected network access policies reconciled' })
    } catch (error) {
      toast({
        title: 'Could not reconcile network access policies',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const columns = useMemo<ColumnDef<AndroidApplication>[]>(
    () => [
      {
        id: 'name',
        accessorFn: application => application.name,
        header: 'Application',
        size: 288,
        meta: { label: 'Application' },
        cell: ({ row }) => (
          <div className='grid gap-1'>
            <Link
              className='truncate font-medium hover:text-primary'
              href={`/app/${row.original.id}/manage`}
            >
              {row.original.name}
            </Link>
            <div className='truncate text-xs text-muted-foreground'>{row.original.id}</div>
          </div>
        )
      },
      {
        id: 'runtime',
        accessorFn: application => application.status.currentStatus,
        header: 'Runtime',
        size: 128,
        meta: { label: 'Runtime' },
        cell: ({ row }) => (
          <span className='capitalize text-sm text-secondary-foreground'>{row.original.status.currentStatus}</span>
        )
      },
      {
        id: 'allowlist',
        header: 'Allowlist',
        size: 416,
        enableSorting: false,
        meta: { label: 'Allowlist' },
        cell: ({ row }) => <AllowlistBadges cidrs={row.original.network.policy.allowCidrs} />
      },
      {
        id: 'result',
        accessorFn: application => application.network.policy.result?.code ?? application.network.policy.status ?? '',
        header: 'Result',
        size: 176,
        meta: { label: 'Result' },
        cell: ({ row }) => {
          const policy = row.original.network.policy
          return (
            <Badge
              className='capitalize'
              variant={policy.result?.status === 'error' ? 'destructive' : 'secondary'}
            >
              {policy.result?.code ?? policy.status ?? 'Not applied'}
            </Badge>
          )
        }
      },
      {
        id: 'restricted',
        accessorFn: application => application.network.policy.enabled,
        header: 'Restricted',
        size: 176,
        meta: { label: 'Restricted' },
        cell: ({ row }) => {
          const policy = row.original.network.policy
          return (
            <label className='flex items-center justify-end gap-2'>
              <span className='text-xs text-secondary-foreground'>
                {policy.enabled ? 'Restricted' : 'Unrestricted'}
              </span>
              <Switch
                checked={policy.enabled}
                disabled={busy !== null}
                aria-label={`Toggle restricted network access for ${row.original.name}`}
                onCheckedChange={checked => void setRestricted(row.original, checked)}
              />
            </label>
          )
        }
      }
    ],
    [busy, setRestricted]
  )

  return (
    <>
      <PlatformStatusBanner
        status={health.status}
        ok={health.ok}
        message={health.message}
      />
      <Section
        title='Network access policies'
        titleClassName='pb-2'
        contentClassName='gap-4'
      >
        <DataGridToolbar
          search={search}
          searchPlaceholder='Search policies'
          onSearchChange={setSearch}
          onSearchSubmit={() => setSubmittedSearch(search.trim())}
          selectedCount={selectedApplications.length}
          actions={
            <Button
              type='button'
              variant='ghost'
              disabled={busy !== null || applications.length === 0}
              onClick={() => void reconcileSelected()}
            >
              {busy === 'reconcile' ? (
                <IconLoader2 className='size-4 animate-spin' />
              ) : (
                <IconShieldCheck className='size-4' />
              )}
              {selectedApplications.length > 0
                ? `Reconcile ${selectedApplications.length} selected`
                : 'Prune stale rules'}
            </Button>
          }
        />
        <TooltipProvider delayDuration={150}>
          <DataGrid
            columns={columns}
            data={paginatedApplications}
            totalItems={sortedApplications.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            getRowId={application => application.id}
            sorting={sorting}
            onSortingChange={updater => {
              setSorting(current => (typeof updater === 'function' ? updater(current) : updater))
              setPageIndex(0)
            }}
            selection={{
              selectedIds,
              onSelectedIdsChange: setSelectedIds
            }}
            minWidth='74rem'
            emptyState={
              <div className='text-center text-secondary-foreground'>
                {submittedSearch ? 'No policies match this search.' : 'No application containers are configured.'}
              </div>
            }
          />
        </TooltipProvider>
        <DataGridPagination
          totalItems={sortedApplications.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
        />
      </Section>
    </>
  )
}
