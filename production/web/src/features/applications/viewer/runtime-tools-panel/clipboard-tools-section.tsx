'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { IconClipboard, IconDownload, IconLoader2, IconUpload } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { setApplicationClipboardAction } from '@/server/orchestrator/applications/mutation-actions'
import { getApplicationClipboardAction } from '@/server/orchestrator/applications/read-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { runtimeActionErrorToast } from './runtime-tools-panel.utils'
import { ToolSection } from './tool-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const ClipboardToolsSection = ({
  app,
  permissions,
  className,
  hideHeader
}: {
  app: AppDefinition
  permissions: PermissionMap
  className?: string
  hideHeader?: boolean
}) => {
  const runtimeAvailable = app.status === 'running'
  const canSyncClipboard = hasPermission(permissions, 'applications:sync-clipboard')
  const [clipboardText, setClipboardText] = useState('')
  const [isClipboardBusy, startClipboardTransition] = useTransition()
  const lastHostClipboardRef = useRef('')
  const lastAppClipboardRef = useRef('')
  const autoSyncInFlightRef = useRef(false)

  const pullClipboard = useCallback(() => {
    startClipboardTransition(async () => {
      try {
        const clipboard = await getApplicationClipboardAction(app.id)
        setClipboardText(clipboard.text)
        lastAppClipboardRef.current = clipboard.text

        if (!clipboard.supported) {
          toast({
            title: 'Clipboard unavailable',
            description: clipboard.message ?? 'This runtime does not expose Android clipboard commands.',
            variant: 'destructive'
          })
        }
      } catch (error) {
        runtimeActionErrorToast('Could not read clipboard', error)
      }
    })
  }, [app.id])

  const pushClipboardText = useCallback(
    async (text: string, notify: boolean) => {
      const clipboard = await setApplicationClipboardAction(app.id, text)
      lastAppClipboardRef.current = clipboard.text

      if (!clipboard.supported) {
        if (notify) {
          toast({
            title: 'Clipboard unavailable',
            description: clipboard.message ?? 'This runtime does not expose Android clipboard commands.',
            variant: 'destructive'
          })
        }
        return
      }

      if (notify) {
        toast({ title: 'Clipboard synced' })
      }
    },
    [app.id]
  )

  const pushClipboard = () => {
    startClipboardTransition(async () => {
      try {
        await pushClipboardText(clipboardText, true)
      } catch (error) {
        runtimeActionErrorToast('Could not sync clipboard', error)
      }
    })
  }

  useEffect(() => {
    if (!runtimeAvailable || !canSyncClipboard || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }

    let cancelled = false

    const syncHostClipboardToApp = async () => {
      if (cancelled || document.visibilityState !== 'visible' || autoSyncInFlightRef.current) {
        return
      }

      autoSyncInFlightRef.current = true
      try {
        const hostText = await navigator.clipboard.readText()
        if (cancelled || hostText === lastHostClipboardRef.current || hostText === lastAppClipboardRef.current) {
          return
        }

        lastHostClipboardRef.current = hostText
        setClipboardText(hostText)
        await pushClipboardText(hostText, false)
      } catch {
        // Browser clipboard reads can be denied until the user interacts with the page.
      } finally {
        autoSyncInFlightRef.current = false
      }
    }

    const syncAppClipboardToHost = async () => {
      if (cancelled || document.visibilityState !== 'visible' || autoSyncInFlightRef.current) {
        return
      }

      autoSyncInFlightRef.current = true
      try {
        const clipboard = await getApplicationClipboardAction(app.id)
        if (cancelled || !clipboard.supported || clipboard.text === lastAppClipboardRef.current) {
          return
        }

        lastAppClipboardRef.current = clipboard.text
        lastHostClipboardRef.current = clipboard.text
        setClipboardText(clipboard.text)
        await navigator.clipboard.writeText(clipboard.text).catch(() => undefined)
      } catch {
        // Keep automatic sync quiet; manual buttons still surface errors.
      } finally {
        autoSyncInFlightRef.current = false
      }
    }

    const syncVisibleClipboard = () => {
      void syncHostClipboardToApp()
      window.setTimeout(() => {
        void syncAppClipboardToHost()
      }, 400)
    }

    window.addEventListener('focus', syncVisibleClipboard)
    document.addEventListener('visibilitychange', syncVisibleClipboard)
    document.addEventListener('copy', syncVisibleClipboard)
    document.addEventListener('cut', syncVisibleClipboard)
    document.addEventListener('paste', syncVisibleClipboard)
    const hostInterval = window.setInterval(() => {
      void syncHostClipboardToApp()
    }, 2500)
    const appInterval = window.setInterval(() => {
      void syncAppClipboardToHost()
    }, 5000)
    syncVisibleClipboard()

    return () => {
      cancelled = true
      window.removeEventListener('focus', syncVisibleClipboard)
      document.removeEventListener('visibilitychange', syncVisibleClipboard)
      document.removeEventListener('copy', syncVisibleClipboard)
      document.removeEventListener('cut', syncVisibleClipboard)
      document.removeEventListener('paste', syncVisibleClipboard)
      window.clearInterval(hostInterval)
      window.clearInterval(appInterval)
    }
  }, [app.id, canSyncClipboard, pushClipboardText, runtimeAvailable])

  useEffect(() => {
    const handleViewerClipboard = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') {
        return
      }

      const payload = event.data as Record<string, unknown>
      if (payload.type !== 'rebroid-viewer-clipboard' || typeof payload.text !== 'string') {
        return
      }

      lastAppClipboardRef.current = payload.text
      lastHostClipboardRef.current = payload.text
      setClipboardText(payload.text)
    }

    window.addEventListener('message', handleViewerClipboard)
    return () => {
      window.removeEventListener('message', handleViewerClipboard)
    }
  }, [])

  if (!canSyncClipboard) {
    return null
  }

  return (
    <ToolSection
      title='Clipboard'
      icon={<IconClipboard className='size-5' />}
      className={className}
      hideHeader={hideHeader}
      actions={
        <>
          <Button
            type='button'
            size='sm'
            variant='secondary'
            disabled={!runtimeAvailable || isClipboardBusy}
            onClick={pullClipboard}
          >
            {isClipboardBusy ? <IconLoader2 className='size-4 animate-spin' /> : <IconDownload className='size-4' />}
            Pull
          </Button>
          <Button
            type='button'
            size='sm'
            disabled={!runtimeAvailable || isClipboardBusy}
            onClick={pushClipboard}
          >
            {isClipboardBusy ? <IconLoader2 className='size-4 animate-spin' /> : <IconUpload className='size-4' />}
            Push
          </Button>
        </>
      }
    >
      <Textarea
        value={clipboardText}
        rows={3}
        placeholder='Clipboard text'
        disabled={!runtimeAvailable}
        onChange={event => {
          setClipboardText(event.target.value)
          lastHostClipboardRef.current = event.target.value
        }}
      />
    </ToolSection>
  )
}
