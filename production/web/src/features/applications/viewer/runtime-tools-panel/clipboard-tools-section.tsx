'use client'

import { useState, useTransition } from 'react'
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
  className
}: {
  app: AppDefinition
  permissions: PermissionMap
  className?: string
}) => {
  const runtimeAvailable = app.status === 'running'
  const canSyncClipboard = hasPermission(permissions, 'applications:sync-clipboard')
  const [clipboardText, setClipboardText] = useState('')
  const [isClipboardBusy, startClipboardTransition] = useTransition()

  const pullClipboard = () => {
    startClipboardTransition(async () => {
      try {
        const clipboard = await getApplicationClipboardAction(app.id)
        setClipboardText(clipboard.text)

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
  }

  const pushClipboard = () => {
    startClipboardTransition(async () => {
      try {
        const clipboard = await setApplicationClipboardAction(app.id, clipboardText)

        if (!clipboard.supported) {
          toast({
            title: 'Clipboard unavailable',
            description: clipboard.message ?? 'This runtime does not expose Android clipboard commands.',
            variant: 'destructive'
          })
          return
        }

        toast({ title: 'Clipboard synced' })
      } catch (error) {
        runtimeActionErrorToast('Could not sync clipboard', error)
      }
    })
  }

  if (!canSyncClipboard) {
    return null
  }

  return (
    <ToolSection
      title='Clipboard'
      icon={<IconClipboard className='size-5' />}
      className={className}
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
        onChange={event => setClipboardText(event.target.value)}
      />
    </ToolSection>
  )
}
