'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { IconShieldCheck } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  reconcileNetworkPoliciesAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { approvedDestinationsLabel, unrestrictedAccessLabel } from '@/shared/model/network/outbound-policy'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import {
  clampFirewallPageIndex,
  firewallReconcileActionState,
  firewallPolicyEnforcement,
  filterFirewallApplications,
  mergeFirewallApplications,
  paginateFirewallApplications,
  retainVisibleFirewallSelection,
  selectedFirewallApplicationsFromIds,
  sortFirewallApplications
} from '../model/firewall-settings-model'
import { firewallPolicyColumns } from '../ui/firewall-policy-columns'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { SortingState } from '@tanstack/react-table'

const matchesAccess = (application: AndroidApplication, filter: string) =>
  filter === 'all' || application.network.policy.enabled === (filter === 'restricted')

export const FirewallSettings = ({
  initialApplications,
  loading = false
}: {
  initialApplications: AndroidApplication[]
  loading?: boolean
}) => {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const mutationPending = useRef(false)
  const [snapshot, setSnapshot] = useState(initialApplications)
  const [applications, setApplications] = useState(initialApplications)
  const [reconciling, setReconciling] = useState(false)
  const refreshStatus = refreshing ? 'refresh' : null
  const busy = reconciling ? 'reconcile' : refreshStatus
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [accessFilter, setAccessFilter] = useState('all')
  const [runtimeFilter, setRuntimeFilter] = useState('all')
  const [enforcementFilter, setEnforcementFilter] = useState('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  if (snapshot !== initialApplications) {
    setSnapshot(initialApplications)
    setApplications(initialApplications)
  }

  const filteredApplications = useMemo(
    () =>
      filterFirewallApplications(applications, submittedSearch).filter(application => {
        if (!matchesAccess(application, accessFilter)) return false
        if (runtimeFilter !== 'all' && application.status.currentStatus !== runtimeFilter) return false
        if (enforcementFilter !== 'all' && firewallPolicyEnforcement(application).label !== enforcementFilter)
          return false
        return true
      }),
    [applications, accessFilter, enforcementFilter, runtimeFilter, submittedSearch]
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

  const reconcileSelected = async () => {
    if (mutationPending.current || refreshing) return
    mutationPending.current = true
    const targets = selectedApplications
    setReconciling(true)
    try {
      if (targets.length === 0) {
        await reconcileNetworkPoliciesAction()
        startRefresh(() => router.refresh())
        toast({
          title: 'Firewall rules synced',
          description: 'The firewall refreshed rules from saved policies and removed stale rules.',
          variant: 'success'
        })
        return
      }
      const results = await Promise.allSettled(
        targets.map(async application => unwrapActionResult(await applyNetworkPolicyAction(application.id)))
      )
      const updated = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []))
      const failedIds = new Set(
        targets
          .filter((_, index) => {
            const result = results[index]
            if (result?.status !== 'fulfilled') return true
            const { tone } = firewallPolicyEnforcement(result.value)
            return tone === 'danger' || tone === 'warning'
          })
          .map(application => application.id)
      )
      const failedUpdates = updated.filter(application => failedIds.has(application.id))
      if (failedUpdates.some(application => !matchesAccess(application, accessFilter))) setAccessFilter('all')
      if (
        runtimeFilter !== 'all' &&
        failedUpdates.some(application => application.status.currentStatus !== runtimeFilter)
      ) {
        setRuntimeFilter('all')
      }
      if (
        enforcementFilter !== 'all' &&
        failedUpdates.some(application => firewallPolicyEnforcement(application).label !== enforcementFilter)
      ) {
        setEnforcementFilter('all')
      }
      if (filterFirewallApplications(failedUpdates, submittedSearch).length !== failedUpdates.length) {
        setSearch('')
        setSubmittedSearch('')
      }
      setApplications(current => mergeFirewallApplications(current, updated))
      setSelectedIds(failedIds)
      const syncedCount = targets.length - failedIds.size
      toast(
        failedIds.size > 0
          ? {
              title: 'Some firewall rules could not be confirmed',
              description: `${syncedCount} synced. ${failedIds.size} remain selected for retry.`,
              variant: 'danger'
            }
          : { title: 'Selected firewall rules synced', variant: 'success' }
      )
    } catch (error) {
      toast({
        title: 'Could not sync firewall rules',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      mutationPending.current = false
      setReconciling(false)
    }
  }

  return (
    <Section
      surface='plain'
      title='Network policies'
      description='Monitor outbound access and firewall enforcement. Open an app to edit its policy.'
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
              label='Outbound access'
              layout='vertical'
            >
              <Select
                value={accessFilter}
                onValueChange={setAccessFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any access mode</SelectItem>
                  <SelectItem value='restricted'>{approvedDestinationsLabel}</SelectItem>
                  <SelectItem value='unrestricted'>{unrestrictedAccessLabel}</SelectItem>
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
                  {Array.from(new Set(applications.map(application => application.status.currentStatus))).map(value => (
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
            <FormField
              label='Firewall enforcement'
              layout='vertical'
            >
              <Select
                value={enforcementFilter}
                onValueChange={setEnforcementFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any enforcement state</SelectItem>
                  {Array.from(
                    new Set(applications.map(application => firewallPolicyEnforcement(application).label))
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
          ...(accessFilter !== 'all'
            ? [
                {
                  id: 'access',
                  label: 'Access',
                  value: accessFilter === 'restricted' ? approvedDestinationsLabel : unrestrictedAccessLabel,
                  onRemove: () => setAccessFilter('all')
                }
              ]
            : []),
          ...(runtimeFilter !== 'all'
            ? [{ id: 'runtime', label: 'Runtime', value: runtimeFilter, onRemove: () => setRuntimeFilter('all') }]
            : []),
          ...(enforcementFilter !== 'all'
            ? [
                {
                  id: 'enforcement',
                  label: 'Enforcement',
                  value: enforcementFilter,
                  onRemove: () => setEnforcementFilter('all')
                }
              ]
            : [])
        ]}
        onResetFilters={() => {
          setAccessFilter('all')
          setRuntimeFilter('all')
          setEnforcementFilter('all')
        }}
        selectedCount={selectedApplications.length}
        actions={
          <MutationButton
            type='button'
            variant='ghost'
            disabled={loading || reconcileAction.disabled}
            pending={reconcileAction.busy}
            pendingLabel='Syncing…'
            onClick={() => void reconcileSelected()}
          >
            <IconShieldCheck className='size-4' />
            {selectedApplications.length === 0 ? reconcileAction.label : 'Sync all rules'}
          </MutationButton>
        }
        bulkActions={
          <MutationButton
            type='button'
            variant='ghost'
            disabled={reconcileAction.disabled}
            pending={reconcileAction.busy}
            pendingLabel='Syncing…'
            onClick={() => void reconcileSelected()}
          >
            <IconShieldCheck className='size-4' />
            {reconcileAction.label}
          </MutationButton>
        }
      >
        <TooltipProvider delayDuration={150}>
          <DataGrid
            columns={firewallPolicyColumns}
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
            minWidth='64rem'
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
  )
}
