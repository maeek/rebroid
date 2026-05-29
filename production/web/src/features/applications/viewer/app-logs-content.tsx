'use client'

import { useCallback, useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { getApplicationLogsAction } from '@/server/orchestrator/applications/read-actions'
import { LogsConsole } from '../../orchestrator/logs/logs-console'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationLog } from '@/server/orchestrator/applications/types'

const getToastErrorDescription = (error: unknown): string => {
  const message = error instanceof Error ? error.message.trim() : ''
  if (!message) {
    return 'The server did not return details for this failure.'
  }

  const loweredMessage = message.toLowerCase()
  if (
    loweredMessage.includes('an error occurred in the server components render') ||
    loweredMessage.includes('specific message is omitted in production builds') ||
    loweredMessage.includes('digest property is included')
  ) {
    return 'The server did not return details for this failure.'
  }

  if (loweredMessage === 'failed to fetch' || loweredMessage.includes('fetch failed')) {
    return 'Could not reach the server.'
  }

  return message
}

type AppLogsContentProps = {
  app?: AppDefinition
}

type LogSource = 'orchestrator' | 'container' | 'adb'

const isSourceUnavailableForApp = (app: AppDefinition | undefined, source: LogSource) => {
  if (!app) {
    return true
  }

  if (source === 'orchestrator') {
    return false
  }

  if (source === 'adb') {
    return !app.running
  }

  return !app.containerId || app.status === 'stopped' || app.status === 'removed'
}

const unavailableSourceMessage = (app: AppDefinition | undefined, source: LogSource) => {
  if (!app) {
    return 'Select an application to inspect logs.'
  }

  if (source === 'adb') {
    return 'ADB logs are available after the Android container is running.'
  }

  if (source === 'container') {
    return app.status === 'stopped'
      ? 'Container logs are unavailable because the runtime container is currently stopped.'
      : 'Container logs are unavailable because no runtime container exists yet.'
  }

  return 'Refresh logs to inspect orchestrator lifecycle events.'
}

export const AppLogsContent = ({ app }: AppLogsContentProps) => {
  const [source, setSource] = useState<LogSource>('orchestrator')
  const [log, setLog] = useState<ApplicationLog>()
  const [isLoading, setIsLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const sourceUnavailable = isSourceUnavailableForApp(app, source)

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

    setIsLoading(true)
    setHasAttemptedLoad(true)
    try {
      setLog(await getApplicationLogsAction(app.id, source, 500))
    } catch (error) {
      setIsLive(false)
      toast({
        title: 'Could not load logs',
        description: getToastErrorDescription(error),
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [app, source, sourceUnavailable])

  useEffect(() => {
    setLog(undefined)
    setHasAttemptedLoad(false)
  }, [app?.id, source])

  useEffect(() => {
    if (!log || isLoading || hasAttemptedLoad) {
      return
    }

    void loadLogs()
  }, [hasAttemptedLoad, isLoading, loadLogs, log])

  useEffect(() => {
    if (!isLive || sourceUnavailable) {
      return
    }

    void loadLogs()
    const interval = window.setInterval(() => void loadLogs(), 3000)
    return () => window.clearInterval(interval)
  }, [isLive, loadLogs, sourceUnavailable])

  return (
    <LogsConsole
      log={log}
      isRefreshing={isLoading}
      refreshDisabled={!app}
      onRefresh={() => void loadLogs()}
      emptyMessage='Refresh logs to inspect container startup failures or Android logcat output.'
      controls={
        <div className='flex items-center gap-2 max-sm:flex-col max-sm:items-stretch'>
          <Select
            value={source}
            onValueChange={value => {
              if (value === 'adb' || value === 'container' || value === 'orchestrator') {
                setSource(value)
              }
              setLog(undefined)
            }}
          >
            <SelectTrigger className='w-44 max-sm:w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='orchestrator'>Orchestrator events</SelectItem>
              <SelectItem value='container'>Container logs</SelectItem>
              <SelectItem value='adb'>ADB logcat</SelectItem>
            </SelectContent>
          </Select>
          <label className='ml-auto flex items-center gap-2 text-sm text-secondary-foreground max-sm:ml-0'>
            Live
            <Switch
              checked={isLive}
              disabled={sourceUnavailable}
              onCheckedChange={setIsLive}
            />
          </label>
        </div>
      }
    />
  )
}
