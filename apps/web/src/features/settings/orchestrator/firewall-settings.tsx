'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconShieldCheck } from '@tabler/icons-react'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  reconcileNetworkPoliciesAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { PlatformStatusBanner } from '@/shared/ui/platform/platform-status-banner'
import { useFirewallPolicyColumns } from './firewall-policy-columns'
import {
  clampFirewallPageIndex,
  firewallReconcileActionState,
  filterFirewallApplications,
  mergeFirewallApplications,
  paginateFirewallApplications,
  replaceFirewallApplication,
  retainVisibleFirewallSelection,
  selectedFirewallApplicationsFromIds,
  sortFirewallApplications
} from './firewall-settings-model'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'
import type { SortingState } from '@tanstack/react-table'

export const FirewallSettings = ({
  initialHealth,
  initialApplications,
  refreshKey = 0,
  onRefreshComplete,
  loading = false
}: {
  initialHealth: ServiceHealth
  initialApplications: AndroidApplication[]
  refreshKey?: number
  onRefreshComplete?: () => void
  loading?: boolean
}) => {
  const lastRefreshKey = useRef(refreshKey)
  const mutationPending = useRef(false)
  const [applications, setApplications] = useState(initialApplications)
  const [health, setHealth] = useState(initialHealth)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [restrictionFilter, setRestrictionFilter] = useState('all')
  const [runtimeFilter, setRuntimeFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const filteredApplications = useMemo(
    () =>
      filterFirewallApplications(applications, submittedSearch).filter(application => {
        if (restrictionFilter === 'restricted' && !application.network.policy.enabled) return false
        if (restrictionFilter === 'unrestricted' && application.network.policy.enabled) return false
        if (runtimeFilter !== 'all' && application.status.currentStatus !== runtimeFilter) return false
        const result = application.network.policy.result?.code ?? 'not-applied'
        if (resultFilter !== 'all' && result !== resultFilter) return false
        return true
      }),
    [applications, restrictionFilter, resultFilter, runtimeFilter, submittedSearch]
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

  const loadSnapshot = useCallback(async () => {
    const [nextHealth, nextApplications] = await Promise.all([getOrchestratorHealthAction(), listApplicationsAction()])
    setHealth(nextHealth.services.firewall)
    setApplications(nextApplications)
  }, [])

  const refresh = useCallback(async () => {
    if (mutationPending.current) {
      onRefreshComplete?.()
      return
    }
    mutationPending.current = true
    setBusy('refresh')
    try {
      await loadSnapshot()
    } catch (error) {
      toast({
        title: 'Could not load network access policies',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      mutationPending.current = false
      setBusy(null)
      onRefreshComplete?.()
    }
  }, [loadSnapshot, onRefreshComplete])

  useEffect(() => {
    if (refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey
      void refresh()
    }
  }, [refresh, refreshKey])

  const setRestricted = useCallback(
    async (application: AndroidApplication, enabled: boolean) => {
      if (mutationPending.current) return
      mutationPending.current = true
      setBusy(application.id)
      try {
        replaceApplication(
          unwrapActionResult(await updateNetworkPolicyAction(application.id, { networkPolicyEnabled: enabled }))
        )
        toast({
          title: enabled ? 'Restricted network access enabled' : 'Unrestricted network access enabled',
          variant: 'success'
        })
      } catch (error) {
        toast({
          title: 'Could not update network access policy',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        })
      } finally {
        mutationPending.current = false
        setBusy(null)
      }
    },
    [replaceApplication]
  )

  const reconcileSelected = async () => {
    if (mutationPending.current) return
    mutationPending.current = true
    const targets = selectedApplications
    setBusy('reconcile')
    try {
      if (targets.length === 0) {
        await reconcileNetworkPoliciesAction()
        await loadSnapshot()
        toast({ title: 'Network policies reconciled', description: 'Stale rules were pruned.', variant: 'success' })
        return
      }
      const results = await Promise.allSettled(
        targets.map(async application => unwrapActionResult(await applyNetworkPolicyAction(application.id)))
      )
      const updated = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []))
      const failedIds = targets
        .filter((_, index) => results[index]?.status === 'rejected')
        .map(application => application.id)
      setApplications(current => mergeFirewallApplications(current, updated))
      setSelectedIds(new Set(failedIds))
      toast(
        failedIds.length > 0
          ? {
              title: 'Some network policies could not be reconciled',
              description: `${updated.length} updated. ${failedIds.length} remain selected for retry.`,
              variant: 'danger'
            }
          : { title: 'Selected network access policies reconciled', variant: 'success' }
      )
    } catch (error) {
      toast({
        title: 'Could not reconcile network access policies',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      mutationPending.current = false
      setBusy(null)
    }
  }

  const columns = useFirewallPolicyColumns({ disabled: loading || busy !== null, onSetRestricted: setRestricted })

  return (
    <>
      <PlatformStatusBanner
        loading={loading}
        status={health.status}
        ok={health.ok}
        message={health.message}
      />
      <Section
        surface='plain'
        title='Application access'
        headingSpacing='compact'
        contentClassName='gap-4'
      >
        <DataGridWorkspace
          disabled={busy !== null}
          search={search}
          searchPlaceholder='Search policies'
          onSearchChange={setSearch}
          onSearch={value => setSubmittedSearch(value.trim())}
          filters={
            <>
              <FormField
                label='Restriction'
                layout='vertical'
              >
                <Select
                  value={restrictionFilter}
                  onValueChange={setRestrictionFilter}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any access mode</SelectItem>
                    <SelectItem value='restricted'>Restricted</SelectItem>
                    <SelectItem value='unrestricted'>Unrestricted</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label='Runtime'
                layout='vertical'
              >
                <Select
                  value={runtimeFilter}
                  onValueChange={setRuntimeFilter}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any runtime state</SelectItem>
                    {Array.from(new Set(applications.map(application => application.status.currentStatus))).map(
                      value => (
                        <SelectItem
                          key={value}
                          value={value}
                        >
                          {value}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label='Result'
                layout='vertical'
              >
                <Select
                  value={resultFilter}
                  onValueChange={setResultFilter}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any result</SelectItem>
                    {Array.from(
                      new Set(applications.map(application => application.network.policy.result?.code ?? 'not-applied'))
                    ).map(value => (
                      <SelectItem
                        key={value}
                        value={value}
                      >
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </>
          }
          activeFilters={[
            ...(restrictionFilter !== 'all'
              ? [
                  {
                    id: 'restriction',
                    label: 'Access',
                    value: restrictionFilter,
                    onRemove: () => setRestrictionFilter('all')
                  }
                ]
              : []),
            ...(runtimeFilter !== 'all'
              ? [{ id: 'runtime', label: 'Runtime', value: runtimeFilter, onRemove: () => setRuntimeFilter('all') }]
              : []),
            ...(resultFilter !== 'all'
              ? [{ id: 'result', label: 'Result', value: resultFilter, onRemove: () => setResultFilter('all') }]
              : [])
          ]}
          onResetFilters={() => {
            setRestrictionFilter('all')
            setRuntimeFilter('all')
            setResultFilter('all')
          }}
          selectedCount={selectedApplications.length}
          actions={
            <MutationButton
              type='button'
              variant='ghost'
              disabled={loading || reconcileAction.disabled}
              pending={reconcileAction.busy}
              pendingLabel='Reconciling…'
              onClick={() => void reconcileSelected()}
            >
              <IconShieldCheck className='size-4' />
              Reconcile all
            </MutationButton>
          }
          bulkActions={
            <MutationButton
              type='button'
              variant='ghost'
              disabled={reconcileAction.disabled}
              pending={reconcileAction.busy}
              pendingLabel='Reconciling…'
              onClick={() => void reconcileSelected()}
            >
              <IconShieldCheck className='size-4' />
              {reconcileAction.label}
            </MutationButton>
          }
        >
          <TooltipProvider delayDuration={150}>
            <DataGrid
              columns={columns}
              loading={loading ? { rowCount: 4, selectable: true, rowMenu: false } : false}
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
                disabled: busy !== null,
                selectedIds,
                onSelectedIdsChange: setSelectedIds
              }}
              minWidth='74rem'
              emptyState={
                <DataGridEmptyState
                  title='No app policies'
                  description='Network policies will appear here when application containers are configured.'
                />
              }
            />
          </TooltipProvider>
          <DataGridPagination
            loading={loading}
            totalItems={sortedApplications.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={size => {
              setPageSize(size)
              setPageIndex(0)
            }}
          />
        </DataGridWorkspace>
      </Section>
    </>
  )
}
