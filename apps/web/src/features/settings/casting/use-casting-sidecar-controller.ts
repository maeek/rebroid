'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  getDisplaySidecarHealthAction,
  listDisplaySidecarSessionsAction,
  repairDisplaySidecarAction,
  releaseDisplaySidecarSessionAction
} from '@/server/orchestrator/diagnostics/actions'
import { activeStatuses, castingErrorMessage, filterSessions, sortSessions } from './casting-sidecar-utils'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { DisplaySidecarSession, ServiceHealth } from '@/shared/contracts/diagnostics'
import type { SortingState } from '@tanstack/react-table'

export const useCastingSidecarController = ({
  initialHealth,
  initialSessions,
  applications,
  refreshKey,
  onRefreshComplete
}: {
  initialHealth: ServiceHealth
  initialSessions: DisplaySidecarSession[]
  applications: Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId' | 'runtime'>[]
  refreshKey: number
  onRefreshComplete?: () => void
}) => {
  const [health, setHealth] = useState(initialHealth)
  const lastRefreshKey = useRef(0)
  const [sessions, setSessions] = useState(initialSessions)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [applicationFilter, setApplicationFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastActivityAt', desc: true }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingEndSessions, setPendingEndSessions] = useState<DisplaySidecarSession[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const appsById = useMemo(() => new Map(applications.map(app => [app.id, app])), [applications])
  const filteredSessions = useMemo(
    () =>
      filterSessions(sessions, appsById, submittedSearch).filter(session => {
        if (statusFilter !== 'all' && session.status !== statusFilter) return false
        if (applicationFilter !== 'all' && session.applicationId !== applicationFilter) return false
        if (ownerFilter !== 'all' && session.ownerUserId !== ownerFilter) return false
        return true
      }),
    [applicationFilter, appsById, ownerFilter, sessions, statusFilter, submittedSearch]
  )
  const sortedSessions = useMemo(() => sortSessions(filteredSessions, sorting), [filteredSessions, sorting])
  const paginatedSessions = useMemo(
    () => sortedSessions.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [pageIndex, pageSize, sortedSessions]
  )
  const selectedSessions = sortedSessions.filter(session => selectedIds.has(session.id))

  useEffect(() => setPageIndex(0), [submittedSearch])
  useEffect(() => {
    const pageCount = Math.max(Math.ceil(sortedSessions.length / pageSize), 1)
    if (pageIndex >= pageCount) setPageIndex(pageCount - 1)
  }, [pageIndex, pageSize, sortedSessions.length])
  useEffect(() => {
    const visibleIds = new Set(sortedSessions.map(session => session.id))
    setSelectedIds(current => {
      const visibleSelection = new Set([...current].filter(id => visibleIds.has(id)))
      return visibleSelection.size === current.size ? current : visibleSelection
    })
  }, [sortedSessions])

  const updateDisplayState = useCallback(async (nextHealth: ServiceHealth) => {
    setHealth(nextHealth)
    if (nextHealth.ok) setSessions(await listDisplaySidecarSessionsAction())
  }, [])

  const refresh = useCallback(async () => {
    setBusy('refresh')
    try {
      await updateDisplayState(await getDisplaySidecarHealthAction())
    } catch (error) {
      toast({
        title: 'Could not load casting sessions',
        description: castingErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setBusy(null)
      onRefreshComplete?.()
    }
  }, [onRefreshComplete, updateDisplayState])

  useEffect(() => {
    if (refreshKey > 0 && refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey
      void refresh()
    }
  }, [refresh, refreshKey])

  const restartSidecar = async () => {
    setBusy('restart')
    try {
      const result = await repairDisplaySidecarAction().catch(() => null)
      if (!result || (!result.ok && result.error.code === 'upstream_unavailable')) {
        toast({
          title: 'Casting sidecar restart unconfirmed',
          description: `The restart may still be in progress. Check the sidecar status before retrying.${
            result ? ` Request ID ${result.requestId}.` : ''
          }`,
          variant: 'warning'
        })
        const currentHealth = await getDisplaySidecarHealthAction().catch(() => null)
        if (currentHealth) await updateDisplayState(currentHealth)
        return
      }
      if (!result.ok) {
        toast({
          title: 'Could not restart casting sidecar',
          description: `${result.error.message} Request ID ${result.requestId}.`,
          variant: 'danger'
        })
        return
      }
      if (result.data.ok) {
        toast({ title: 'Casting sidecar restarted', variant: 'success' })
      } else {
        toast({
          title: 'Casting sidecar is unavailable after restart',
          description: result.data.message,
          variant: 'warning'
        })
      }
      await updateDisplayState(result.data)
    } catch (error) {
      toast({ title: 'Could not load casting sessions', description: castingErrorMessage(error), variant: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  const endSessions = async () => {
    if (!health.ok) return
    const targets = pendingEndSessions
    if (targets.length === 0) return
    setBusy(targets.length === 1 ? targets[0].id : 'bulk')
    try {
      const ended = await Promise.all(
        targets
          .filter(session => activeStatuses.has(session.status))
          .map(session => releaseDisplaySidecarSessionAction(session.id))
      )
      const endedById = new Map(ended.map(session => [session.id, session]))
      setSessions(current => current.map(session => endedById.get(session.id) ?? session))
      setSelectedIds(new Set())
      setPendingEndSessions([])
      toast({
        title: targets.length === 1 ? 'Display session ended' : 'Selected display sessions ended',
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Could not end display session',
        description: castingErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setBusy(null)
    }
  }

  return {
    health,
    busy,
    restartSidecar,
    sessions,
    search,
    setSearch,
    submittedSearch,
    setSubmittedSearch,
    statusFilter,
    setStatusFilter,
    applicationFilter,
    setApplicationFilter,
    ownerFilter,
    setOwnerFilter,
    sorting,
    setSorting,
    selectedIds,
    setSelectedIds,
    pendingEndSessions,
    setPendingEndSessions,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    appsById,
    paginatedSessions,
    selectedSessions,
    sortedSessions,
    endSessions
  }
}

export type CastingSidecarController = ReturnType<typeof useCastingSidecarController>
