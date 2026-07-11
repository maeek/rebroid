'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconShieldCheck } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  reconcileNetworkPoliciesAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/shared/ui/data-grid'
import { PlatformStatusBanner } from '@/shared/ui/platform/platform-status-banner'
import {
  clampFirewallPageIndex,
  firewallAllowlistDisplay,
  firewallPolicyResultDisplay,
  firewallReconcileActionState,
  firewallRestrictionLabel,
  filterFirewallApplications,
  mergeFirewallApplications,
  paginateFirewallApplications,
  replaceFirewallApplication,
  retainVisibleFirewallSelection,
  selectedFirewallApplicationsFromIds,
  sortFirewallApplications
} from './firewall-settings-model'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { ServiceHealth } from '@/server/orchestrator/diagnostics/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const AllowlistBadges = ({ cidrs }: { cidrs: string[] }) => {
  const { empty, hiddenCidrs, visibleCidrs } = firewallAllowlistDisplay(cidrs)

  if (empty) return <span className='text-sm text-foreground-muted'>No custom CIDRs</span>

  return (
    <div className='flex max-w-[24rem] flex-wrap gap-1'>
      {visibleCidrs.map(cidr => (
        <Badge
          key={cidr}
          variant='neutral'
        >
          {cidr}
        </Badge>
      ))}
      <Visible when={hiddenCidrs.length > 0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant='outline'>+{hiddenCidrs.length}</Badge>
          </TooltipTrigger>
          <TooltipContent className='max-w-sm break-all'>{hiddenCidrs.join(', ')}</TooltipContent>
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
  const filteredApplications = useMemo(
    () => filterFirewallApplications(applications, submittedSearch),
    [applications, submittedSearch]
  )
  const sortedApplications = useMemo(
    () => sortFirewallApplications(filteredApplications, sorting),
    [filteredApplications, sorting]
  )
  const paginatedApplications = useMemo(
    () => paginateFirewallApplications(sortedApplications, pageIndex, pageSize),
    [pageIndex, pageSize, sortedApplications]
  )
  const selectedApplications = selectedFirewallApplicationsFromIds(sortedApplications, selectedIds)
  const reconcileAction = firewallReconcileActionState({
    applicationCount: applications.length,
    busy,
    selectedCount: selectedApplications.length
  })

  useEffect(() => setPageIndex(0), [submittedSearch])
  useEffect(() => {
    const nextPageIndex = clampFirewallPageIndex(sortedApplications.length, pageSize, pageIndex)
    if (pageIndex !== nextPageIndex) setPageIndex(nextPageIndex)
  }, [pageIndex, pageSize, sortedApplications.length])
  useEffect(() => {
    setSelectedIds(current => retainVisibleFirewallSelection(sortedApplications, current))
  }, [sortedApplications])

  const replaceApplication = useCallback(
    (application: AndroidApplication) => setApplications(current => replaceFirewallApplication(current, application)),
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
        variant: 'danger'
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
          variant: 'danger'
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
        toast({ title: 'Network policy rules reconciled and stale rules pruned' })
        return
      }
      const updated = await Promise.all(targets.map(application => applyNetworkPolicyAction(application.id)))
      setApplications(current => mergeFirewallApplications(current, updated))
      setSelectedIds(new Set())
      toast({ title: 'Selected network access policies reconciled' })
    } catch (error) {
      toast({
        title: 'Could not reconcile network access policies',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
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
            <div className='truncate text-xs text-foreground-muted'>{row.original.id}</div>
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
          <span className='capitalize text-sm text-foreground-muted'>{row.original.status.currentStatus}</span>
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
          const result = firewallPolicyResultDisplay(row.original)
          return (
            <Badge
              className='capitalize'
              variant={result.variant}
            >
              {result.label}
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
          const label = firewallRestrictionLabel(row.original)
          return (
            <label className='flex items-center justify-end gap-2'>
              <span className='text-xs text-foreground-muted'>{label}</span>
              <Switch
                checked={row.original.network.policy.enabled}
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
        surface='plain'
        title='Network policies'
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
              disabled={reconcileAction.disabled}
              onClick={() => void reconcileSelected()}
            >
              {reconcileAction.busy ? (
                <IconLoader2 className='size-4 animate-spin' />
              ) : (
                <IconShieldCheck className='size-4' />
              )}
              {reconcileAction.label}
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
              <div className='text-center text-foreground-muted'>
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
