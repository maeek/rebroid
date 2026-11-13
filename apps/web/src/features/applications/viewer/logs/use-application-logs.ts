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
  const [unavailableLog, setUnavailableLog] = useState<{ key: string; log: ApplicationLog }>()
  const [isLive, setIsLive] = useState(false)
  const [attemptedKey, setAttemptedKey] = useState<string>()
  const appId = app?.id
  const requestKey = JSON.stringify([appId, source])
  const sourceUnavailable = isSourceUnavailableForApp(app, source)
  const unavailableMessage = unavailableSourceMessage(app, source)
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
  let log = refreshedLog
  if (sourceUnavailable) {
    log = unavailableLog?.key === requestKey ? unavailableLog.log : undefined
  }

  const changeSource = useCallback((value: string) => {
    if (value === 'adb' || value === 'container' || value === 'orchestrator') {
      setSource(value)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    if (!appId) {
      return
    }

    if (sourceUnavailable) {
      setUnavailableLog({
        key: requestKey,
        log: { source, collectedAt: new Date().toISOString(), output: unavailableMessage }
      })
      setAttemptedKey(requestKey)
      setIsLive(false)
      return
    }

    setAttemptedKey(requestKey)
    try {
      await refreshLogs()
    } catch (error) {
      setIsLive(false)
      toast({
        title: 'Could not load logs',
        description: getToastErrorDescription(error),
        variant: 'danger'
      })
    }
  }, [appId, refreshLogs, requestKey, source, sourceUnavailable, unavailableMessage])

  useEffect(() => {
    if (!enabled || !loadWhenEnabled || log || isLoading || attemptedKey === requestKey) {
      return
    }

    void loadLogs()
  }, [attemptedKey, enabled, isLoading, loadLogs, loadWhenEnabled, log, requestKey])

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
