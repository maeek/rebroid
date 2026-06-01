'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconRefresh, IconShieldCheck } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { PlatformGridPagination } from '@/features/orchestrator/components/platform-grid-pagination'
import { PlatformSelectionToolbar } from '@/features/orchestrator/components/platform-selection-toolbar'
import { useGridSelection } from '@/features/orchestrator/components/use-grid-selection'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  reconcileNetworkPoliciesAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/mutation-actions'
import { listApplicationsAction } from '@/server/orchestrator/applications/read-actions'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { ServiceHealth } from '@/server/orchestrator/diagnostics/types'

const visibleCidrCount = 3

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
  initialApplications
}: {
  initialHealth: ServiceHealth
  initialApplications: AndroidApplication[]
}) => {
  const [applications, setApplications] = useState(initialApplications)
  const [health] = useState(initialHealth)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase()
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
  }, [applications, search])
  const paginatedApplications = useMemo(
    () => filteredApplications.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredApplications, pageIndex, pageSize]
  )
  const selection = useGridSelection(filteredApplications)

  useEffect(() => setPageIndex(0), [search])
  useEffect(() => {
    const pageCount = Math.max(Math.ceil(filteredApplications.length / pageSize), 1)
    if (pageIndex >= pageCount) setPageIndex(pageCount - 1)
  }, [filteredApplications.length, pageIndex, pageSize])

  const replaceApplication = (application: AndroidApplication) =>
    setApplications(current => current.map(item => (item.id === application.id ? application : item)))

  const refresh = async () => {
    setBusy('refresh')
    try {
      setApplications(await listApplicationsAction())
    } catch (error) {
      toast({
        title: 'Could not load network access policies',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const setRestricted = async (application: AndroidApplication, enabled: boolean) => {
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
  }

  const reconcileSelected = async () => {
    const targets = selection.selectedItems
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
      selection.clearSelection()
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

  return (
    <Section
      title='Network access policies'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-4'
    >
      <div className='flex flex-wrap items-center gap-3'>
        <Badge
          className='capitalize'
          variant={health.ok ? 'status' : 'warning'}
        >
          {health.status}
        </Badge>
        <span className='text-sm text-secondary-foreground'>{health.message}</span>
      </div>
      <PlatformSelectionToolbar
        search={search}
        placeholder='Search policies'
        selectedCount={selection.selectedItems.length}
        onSearchChange={setSearch}
        actions={
          <>
            <Button
              type='button'
              variant='ghost'
              disabled={busy !== null}
              onClick={() => void refresh()}
            >
              {busy === 'refresh' ? (
                <IconLoader2 className='size-4 animate-spin' />
              ) : (
                <IconRefresh className='size-4' />
              )}
              Refresh
            </Button>
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
              {selection.selectedItems.length > 0
                ? `Reconcile ${selection.selectedItems.length} selected`
                : 'Prune stale rules'}
            </Button>
          </>
        }
      />
      <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
        <TooltipProvider delayDuration={150}>
          <Table
            className='table-fixed'
            style={{ minWidth: '74rem' }}
          >
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-12 px-4 py-3'>
                  <Checkbox
                    checked={
                      paginatedApplications.length > 0 &&
                      paginatedApplications.every(app => selection.selectedIds.has(app.id))
                    }
                    onCheckedChange={checked => selection.selectPage(paginatedApplications, checked === true)}
                  />
                </TableHead>
                <TableHead className='w-[18rem] px-4 py-3 uppercase'>Application</TableHead>
                <TableHead className='w-32 px-4 py-3 uppercase'>Runtime</TableHead>
                <TableHead className='w-[26rem] px-4 py-3 uppercase'>Allowlist</TableHead>
                <TableHead className='w-44 px-4 py-3 uppercase'>Result</TableHead>
                <TableHead className='w-44 px-4 py-3 text-right uppercase'>Restricted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Visible when={filteredApplications.length === 0}>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='px-4 py-4 text-secondary-foreground'
                  >
                    {search.trim() ? 'No policies match this search.' : 'No application containers are configured.'}
                  </TableCell>
                </TableRow>
              </Visible>
              {paginatedApplications.map((application, index) => {
                const policy = application.network.policy
                return (
                  <TableRow key={application.id}>
                    <TableCell className='px-4 py-3'>
                      <Checkbox
                        checked={selection.selectedIds.has(application.id)}
                        onClick={event =>
                          selection.toggleSelection(application, pageIndex * pageSize + index, event.shiftKey)
                        }
                        onCheckedChange={() => undefined}
                      />
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <Link
                        className='font-medium hover:text-primary'
                        href={`/app/${application.id}/manage`}
                      >
                        {application.name}
                      </Link>
                      <div className='truncate text-xs text-muted-foreground'>{application.id}</div>
                    </TableCell>
                    <TableCell className='px-4 py-3 capitalize text-secondary-foreground'>
                      {application.status.currentStatus}
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <AllowlistBadges cidrs={policy.allowCidrs} />
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <Badge
                        className='capitalize'
                        variant={policy.result?.status === 'error' ? 'destructive' : 'secondary'}
                      >
                        {policy.result?.code ?? policy.status ?? 'Not applied'}
                      </Badge>
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <label className='flex items-center justify-end gap-2'>
                        <span className='text-xs text-secondary-foreground'>
                          {policy.enabled ? 'Restricted' : 'Unrestricted'}
                        </span>
                        <Switch
                          checked={policy.enabled}
                          disabled={busy !== null}
                          aria-label={`Toggle restricted network access for ${application.name}`}
                          onCheckedChange={checked => void setRestricted(application, checked)}
                        />
                      </label>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
      <PlatformGridPagination
        totalItems={filteredApplications.length}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={setPageSize}
      />
    </Section>
  )
}
