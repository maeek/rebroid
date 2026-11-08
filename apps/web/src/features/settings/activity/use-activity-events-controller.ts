'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { purgeAllAuditEventsAction, saveAuditRetentionAction } from '@/server/audit/actions'
import { useActivityQuery } from './use-activity-query'
import type { ActivityEventsTableProps } from './activity-types'
import type { AuditEvent } from '@/shared/contracts/audit'

export const useActivityEventsController = (props: ActivityEventsTableProps) => {
  const { auditRetentionDays, application, loading } = props
  const query = useActivityQuery(props)
  const router = useRouter()
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [retentionDays, setRetentionDays] = useState(String(auditRetentionDays))
  const [retentionOpen, setRetentionOpen] = useState(false)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [isSavingRetention, startSavingRetention] = useTransition()
  const [isRefreshing, startRefreshing] = useTransition()
  const [isPurging, setIsPurging] = useState(false)

  useEffect(() => {
    setRetentionDays(String(auditRetentionDays))
  }, [auditRetentionDays])

  const saveRetention = () => {
    if (application || loading || isSavingRetention || isPurging) return
    const nextValue = Number(retentionDays)
    startSavingRetention(async () => {
      try {
        const saved = await saveAuditRetentionAction(nextValue)
        setRetentionDays(String(saved.auditRetentionDays))
        setRetentionOpen(false)
        toast({
          title: 'Retention updated',
          description: `Activity logs are retained for ${saved.auditRetentionDays} days.`,
          variant: 'success'
        })
        router.refresh()
      } catch (error) {
        toast({
          title: 'Could not update retention',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'danger'
        })
      }
    })
  }

  const purgeAll = async () => {
    if (application || loading || isSavingRetention || isPurging) return
    setIsPurging(true)
    try {
      const purgeResult = await purgeAllAuditEventsAction()
      toast({
        title: 'Activity logs purged',
        description: `${purgeResult.purged} events were removed.`,
        variant: 'success'
      })
      setPurgeOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        title: 'Could not purge activity logs',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setIsPurging(false)
    }
  }

  return {
    ...query,
    isSavingRetention,
    isRefreshing,
    isPurging,
    purgeAll,
    purgeOpen,
    refresh: () => {
      if (!loading) startRefreshing(() => router.refresh())
    },
    retentionDays,
    retentionOpen,
    saveRetention,
    selectedEvent,
    setPurgeOpen,
    setRetentionDays,
    setRetentionOpen,
    setSelectedEvent
  }
}
