'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { IconDevicesCheck, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { useVisibilityAwareInterval } from '@/hooks/use-visibility-aware-interval'
import {
  getApplicationClipboardAction,
  setApplicationClipboardAction
} from '@/server/orchestrator/applications/actions/runtime/clipboard-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { runtimeActionErrorToast } from '../runtime-tools-panel.utils'
import { ToolSection } from '../tool-section'
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
  const lastAppClipboardRef = useRef('')

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
            variant: 'danger'
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
            variant: 'danger'
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

  const syncAppClipboardToHost = useCallback(async () => {
    try {
      const clipboard = await getApplicationClipboardAction(app.id)
      if (!clipboard.supported || clipboard.text === lastAppClipboardRef.current) {
        return
      }

      lastAppClipboardRef.current = clipboard.text
      setClipboardText(clipboard.text)
      await navigator.clipboard.writeText(clipboard.text).catch(() => undefined)
    } catch {
      // Keep automatic sync quiet; manual buttons still surface errors.
    }
  }, [app.id])

  useVisibilityAwareInterval({
    enabled: runtimeAvailable && canSyncClipboard && typeof navigator !== 'undefined' && Boolean(navigator.clipboard),
    immediate: true,
    intervalMs: 5000,
    task: syncAppClipboardToHost
  })

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
      description='Sync text between the runtime and your device clipboard.'
      className={className}
      hideHeader={hideHeader}
      actions={
        <Button
          type='button'
          size='sm'
          variant='ghost'
          disabled={!runtimeAvailable || isClipboardBusy}
          onClick={pullClipboard}
        >
          {isClipboardBusy ? <IconLoader2 className='size-4 animate-spin' /> : <IconDevicesCheck className='size-4' />}
          Read from device
        </Button>
      }
    >
      <Textarea
        value={clipboardText}
        rows={3}
        placeholder='Clipboard text'
        disabled={!runtimeAvailable}
        onChange={event => {
          setClipboardText(event.target.value)
        }}
        onBlur={() => {
          if (clipboardText !== lastAppClipboardRef.current) {
            void pushClipboard()
          }
        }}
      />
    </ToolSection>
  )
}
