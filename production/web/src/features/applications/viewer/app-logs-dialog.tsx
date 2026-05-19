'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconRefresh, IconTerminal2 } from '@tabler/icons-react'
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
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { getApplicationLogsAction } from '@/server/orchestrator/applications/read-actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationLog } from '@/server/orchestrator/applications/types'

type AppLogsDialogProps = {
  app?: AppDefinition
  triggerClassName?: string
}

export const AppLogsDialog = ({ app, triggerClassName }: AppLogsDialogProps) => {
  const [source, setSource] = useState<'container' | 'adb'>('container')
  const [log, setLog] = useState<ApplicationLog>()
  const [isLoading, setIsLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

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
        description: error instanceof Error ? error.message : 'Unknown error',
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
      setIsOpen(true)
    }
  }, [app])

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
      onOpenChange={open => {
        setIsOpen(open)
        if (!open) {
          setIsLive(false)
        }
      }}
    >
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
      <DialogContent className='grid max-h-[calc(100dvh-2rem)] w-[min(64rem,calc(100vw-2rem))] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-none'>
        <DialogHeader>
          <DialogTitle>{app ? `${app.name} logs` : 'Application logs'}</DialogTitle>
          <DialogDescription>
            Inspect recent container output. ADB logcat is available for Android-compatible runtimes after they start.
          </DialogDescription>
        </DialogHeader>
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
          <Button
            type='button'
            variant='secondary'
            disabled={isLoading || !app}
            onClick={() => void loadLogs()}
          >
            <IconRefresh className={isLoading ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
          <label className='ml-auto flex items-center gap-2 text-sm text-secondary-foreground max-sm:ml-0'>
            Live
            <Switch
              checked={isLive}
              onCheckedChange={setIsLive}
            />
          </label>
        </div>
        <pre className='min-h-0 overflow-auto rounded-md border border-border/60 bg-background/65 p-4 font-mono text-xs leading-5 text-secondary-foreground'>
          {log?.output || 'Refresh logs to inspect container startup failures or Android logcat output.'}
        </pre>
        <Visible when={log}>
          <p className='text-xs text-muted-foreground'>
            Collected {log?.collectedAt ? new Date(log.collectedAt).toLocaleString() : ''}
          </p>
        </Visible>
      </DialogContent>
    </Dialog>
  )
}
