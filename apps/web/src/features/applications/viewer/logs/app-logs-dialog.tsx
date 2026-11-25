'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { IconTerminal2 } from '@tabler/icons-react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { afterClosingBackEntry } from '@/lib/navigation/back-layers'
import { LogsConsole } from '@/shared/ui/logs/logs-console'
import { AppLogsControls } from './app-logs-controls'
import { useApplicationLogs } from './use-application-logs'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

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
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const openFromLink = useSearchParams().get('logs') === '1'
  const appId = app?.id
  const { source, log, isLive, isLoading, sourceUnavailable, changeSource, loadLogs, setIsLive } = useApplicationLogs({
    app,
    enabled: isOpen,
    loadWhenEnabled: true
  })

  const setDialogOpen = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen)
    if (open === undefined) setInternalOpen(nextOpen)
  }
  const openLinkedDialog = useEffectEvent(() => setDialogOpen(true))

  useEffect(() => {
    if (appId && openFromLink) openLinkedDialog()
  }, [appId, openFromLink])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={nextOpen => {
        setDialogOpen(nextOpen)
        if (!nextOpen) {
          setIsLive(false)
          const closedFrom = new URL(window.location.href)
          if (closedFrom.searchParams.get('logs') !== '1') return
          afterClosingBackEntry(() => {
            if (window.location.href !== closedFrom.href) return
            closedFrom.searchParams.delete('logs')
            window.history.replaceState(null, '', closedFrom)
          })
        }
      }}
    >
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button
            type='button'
            variant='ghost'
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
            Inspect orchestrator lifecycle events, container output, or ADB logcat when Android is running.
          </DialogDescription>
        </DialogHeader>
        <LogsConsole
          followOutput={isLive}
          log={log}
          isRefreshing={isLoading}
          refreshDisabled={!app}
          onRefresh={isLive ? undefined : () => void loadLogs()}
          emptyMessage='No log output yet.'
          controls={
            <AppLogsControls
              source={source}
              isLive={isLive}
              sourceUnavailable={sourceUnavailable}
              onSourceChange={changeSource}
              onLiveChange={setIsLive}
            />
          }
        />
      </DialogContent>
    </Dialog>
  )
}
