'use client'

import { useCallback, useEffect, useState } from 'react'
import { getToastErrorDescription } from '@/features/applications/viewer/utils/viewer-error-utils'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import { getApplicationLogsAction } from '@/server/orchestrator/applications/actions/runtime/log-actions'
import { isSourceUnavailableForApp, unavailableSourceMessage, type LogSource } from './app-logs-utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationLog } from '@/shared/contracts/application'

type UseApplicationLogsOptions = {
  app?: AppDefinition
  enabled?: boolean
  loadWhenEnabled?: boolean
}

export const useApplicationLogs = ({ app, enabled = true, loadWhenEnabled = false }: UseApplicationLogsOptions) => {
  const [source, setSource] = useState<LogSource>('orchestrator')
  const [log, setLog] = useState<ApplicationLog>()
  const [isLive, setIsLive] = useState(false)
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const sourceUnavailable = isSourceUnavailableForApp(app, source)
  const {
    data: refreshedLog,
    isValidating: isLoading,
    mutate: refreshLogs
  } = usePollingQuery<ApplicationLog>(
    ['applications', app?.id, 'logs', source],
    () => getApplicationLogsAction(app!.id, source, 500),
    {
      enabled: Boolean(app) && enabled && !sourceUnavailable,
      intervalMs: enabled && isLive ? 3000 : null,
      revalidateOnMount: false,
      onError: () => setIsLive(false)
    }
  )

  const changeSource = useCallback((value: string) => {
    if (value === 'adb' || value === 'container' || value === 'orchestrator') {
      setSource(value)
    }
    setLog(undefined)
  }, [])

  const loadLogs = useCallback(async () => {
    if (!app) {
      return
    }

    if (sourceUnavailable) {
      setLog({
        source,
        collectedAt: new Date().toISOString(),
        output: unavailableSourceMessage(app, source)
      })
      setHasAttemptedLoad(true)
      setIsLive(false)
      return
    }

    setHasAttemptedLoad(true)
    try {
      const nextLog = await refreshLogs()
      if (nextLog) {
        setLog(nextLog)
      }
    } catch (error) {
      setIsLive(false)
      toast({
        title: 'Could not load logs',
        description: getToastErrorDescription(error),
        variant: 'danger'
      })
    }
  }, [app, refreshLogs, source, sourceUnavailable])

  useEffect(() => {
    if (refreshedLog) {
      setLog(refreshedLog)
    }
  }, [refreshedLog])

  useEffect(() => {
    setLog(undefined)
    setHasAttemptedLoad(false)
  }, [app?.id, source])

  useEffect(() => {
    if (!enabled || !loadWhenEnabled || log || isLoading || hasAttemptedLoad) {
      return
    }

    void loadLogs()
  }, [enabled, hasAttemptedLoad, isLoading, loadLogs, loadWhenEnabled, log])

  useEffect(() => {
    if (!enabled || !isLive || sourceUnavailable) {
      return
    }

    void loadLogs()
  }, [enabled, isLive, loadLogs, sourceUnavailable])

  return {
    source,
    log,
    isLive,
    isLoading,
    sourceUnavailable,
    changeSource,
    loadLogs,
    setIsLive
  }
}
