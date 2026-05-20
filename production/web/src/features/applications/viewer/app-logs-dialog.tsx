'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconTerminal2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
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

type AppLogsDialogProps = {
  app?: AppDefinition
  triggerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export const AppLogsDialog = ({
  app,
  triggerClassName,
  open,
  onOpenChange,
  hideTrigger = false
}: AppLogsDialogProps) => {
  const [source, setSource] = useState<'container' | 'adb'>('container')
  const [log, setLog] = useState<ApplicationLog>()
  const [isLoading, setIsLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen)

      if (open === undefined) {
        setInternalOpen(nextOpen)
      }
    },
    [onOpenChange, open]
  )

  const loadLogs = useCallback(async () => {
    if (!app) {
      return
    }

    setIsLoading(true)
    try {
      setLog(await getApplicationLogsAction(app.id, source, 500))
    } catch (error) {
      toast({
        title: 'Could not load logs',
        description: getToastErrorDescription(error),
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [app, source])

  useEffect(() => {
    if (!app || typeof window === 'undefined') {
      return
    }

    const searchParams = new URL(window.location.href).searchParams
    if (searchParams.get('logs') === '1') {
      setDialogOpen(true)
    }
  }, [app, setDialogOpen])

  useEffect(() => {
    if (!isOpen || log || isLoading) {
      return
    }

    void loadLogs()
  }, [isOpen, isLoading, loadLogs, log])

  useEffect(() => {
    if (!isOpen || !isLive) {
      return
    }

    void loadLogs()
    const interval = window.setInterval(() => void loadLogs(), 3000)
    return () => window.clearInterval(interval)
  }, [isLive, isOpen, loadLogs])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={nextOpen => {
        setDialogOpen(nextOpen)
        if (!nextOpen) {
          setIsLive(false)
        }
      }}
    >
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button
            type='button'
            variant='secondary'
            disabled={!app}
            className={triggerClassName}
          >
            <IconTerminal2 className='size-4' />
            Logs
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className='grid min-h-[max(20rem,33dvh)] max-h-[calc(100dvh-2rem)] w-[min(64rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-none'>
        <DialogHeader>
          <DialogTitle>{app ? `${app.name} logs` : 'Application logs'}</DialogTitle>
          <DialogDescription>
            Inspect recent container output. ADB logcat is available for Android-compatible runtimes after they start.
          </DialogDescription>
        </DialogHeader>
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
                  setSource(value === 'adb' ? 'adb' : 'container')
                  setLog(undefined)
                }}
              >
                <SelectTrigger className='w-44 max-sm:w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='container'>Container logs</SelectItem>
                  <SelectItem value='adb'>ADB logcat</SelectItem>
                </SelectContent>
              </Select>
              <label className='ml-auto flex items-center gap-2 text-sm text-secondary-foreground max-sm:ml-0'>
                Live
                <Switch
                  checked={isLive}
                  onCheckedChange={setIsLive}
                />
              </label>
            </div>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
