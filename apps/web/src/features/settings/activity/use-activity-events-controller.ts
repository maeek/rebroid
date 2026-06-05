'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { purgeAllAuditEventsAction, saveAuditRetentionAction } from '@/server/audit/actions'
import { auditSortToSearchParam } from '@/server/audit/query'
import { activityFilterEntries, compactActivityParams, dateDaysAgo } from './activity-format'
import type { ActivityEventsTableProps, ActivityFilterValues } from './activity-types'
import type { AuditEvent } from '@/server/storage/database'
import type { SortingState } from '@tanstack/react-table'

export const useActivityEventsController = ({
  result,
  filters,
  sorting,
  facets,
  auditRetentionDays
}: ActivityEventsTableProps) => {
  const router = useRouter()
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [localFilters, setLocalFilters] = useState<ActivityFilterValues>(filters)
  const [retentionDays, setRetentionDays] = useState(String(auditRetentionDays))
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [retentionOpen, setRetentionOpen] = useState(false)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isPurging, setIsPurging] = useState(false)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  useEffect(() => {
    setRetentionDays(String(auditRetentionDays))
  }, [auditRetentionDays])

  const pushParams = (patch: Partial<ActivityFilterValues> & { page?: number; pageSize?: number; sort?: string }) => {
    const params = compactActivityParams({
      ...filters,
      ...patch,
      page: patch.page ?? 1,
      pageSize: patch.pageSize ?? result.pageSize,
      sort: patch.sort ?? auditSortToSearchParam(sorting)
    })
    router.push(`/operations/activity${params.size ? `?${params.toString()}` : ''}`)
  }

  const exportHref = useMemo(() => {
    const params = compactActivityParams(filters)
    return `/api/activity/export${params.size ? `?${params.toString()}` : ''}`
  }, [filters])

  const activeFilters = useMemo(() => activityFilterEntries(filters, facets), [facets, filters])
  const hasLocalFilters = Object.values(localFilters).some(Boolean)

  const applyFilters = () => {
    setFilterPanelOpen(false)
    pushParams(localFilters)
  }

  const resetFilters = () => {
    setLocalFilters({})
    router.push('/operations/activity')
  }

  const removeFilter = (key: keyof ActivityFilterValues) => {
    const next = { ...filters, [key]: undefined }
    setLocalFilters(next)
    pushParams(next)
  }

  const setRange = (days: number) => {
    setLocalFilters(current => ({ ...current, from: dateDaysAgo(days), to: undefined }))
  }

  const setSorting = (nextSorting: SortingState) => {
    pushParams({ page: 1, sort: auditSortToSearchParam(nextSorting as typeof sorting) })
  }

  const saveRetention = () => {
    const nextValue = Number(retentionDays)
    startTransition(async () => {
      try {
        const saved = await saveAuditRetentionAction(nextValue)
        setRetentionDays(String(saved.auditRetentionDays))
        setRetentionOpen(false)
        toast({
          title: 'Retention updated',
          description: `Activity logs are retained for ${saved.auditRetentionDays} days.`
        })
        router.refresh()
      } catch (error) {
        toast({
          title: 'Could not update retention',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive'
        })
      }
    })
  }

  const purgeAll = async () => {
    setIsPurging(true)
    try {
      const purgeResult = await purgeAllAuditEventsAction()
      toast({ title: 'Activity logs purged', description: `${purgeResult.purged} events were removed.` })
      setPurgeOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not purge activity logs',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsPurging(false)
    }
  }

  return {
    activeFilters,
    applyFilters,
    exportHref,
    filterPanelOpen,
    hasLocalFilters,
    isPending,
    isPurging,
    localFilters,
    purgeAll,
    purgeOpen,
    pushParams,
    removeFilter,
    resetFilters,
    retentionDays,
    retentionOpen,
    saveRetention,
    selectedEvent,
    setFilterPanelOpen,
    setLocalFilters,
    setPurgeOpen,
    setRange,
    setRetentionDays,
    setRetentionOpen,
    setSelectedEvent,
    setSorting
  }
}
