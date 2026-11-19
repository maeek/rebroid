'use client'

import { useContext, useState, useTransition } from 'react'
import { IconClipboard } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Textarea } from '@/components/ui/textarea'
import { runtimeActionErrorToast } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tools-panel.utils'
import { toast } from '@/hooks/use-toast'
import {
  getApplicationClipboardAction,
  setApplicationClipboardAction
} from '@/server/orchestrator/applications/actions/runtime/clipboard-actions'
import {
  MobileViewerActionRows,
  mobileViewerActionRowClassName
} from '../../viewer-control-bar/mobile/mobile-viewer-action-rows'

export const ViewerClipboard = ({ appId }: { appId: string }) => {
  const mobileRow = useContext(MobileViewerActionRows)
  const [text, setText] = useState('')
  const [operation, setOperation] = useState<'read' | 'send'>('read')
  const [pending, startTransition] = useTransition()

  const run = (next: typeof operation) => {
    setOperation(next)
    startTransition(async () => {
      try {
        const result =
          next === 'read'
            ? await getApplicationClipboardAction(appId)
            : await setApplicationClipboardAction(appId, text)
        if (!result.supported) {
          throw new Error(result.message ?? 'This runtime does not expose Android clipboard commands.')
        }
        if (next === 'read') setText(result.text)
        else toast({ title: 'Sent to device clipboard', variant: 'success' })
      } catch (error) {
        runtimeActionErrorToast('Clipboard operation failed', error)
      }
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type='button'
          size={mobileRow ? 'md' : 'icon-md'}
          variant={mobileRow ? 'ghost' : 'secondary'}
          className={mobileRow ? mobileViewerActionRowClassName : 'size-6'}
          aria-label='Device clipboard'
          title='Device clipboard'
        >
          <IconClipboard className='size-3.5' />
          {mobileRow ? 'Device clipboard' : null}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Device clipboard</DialogTitle>
        </DialogHeader>
        <FormField
          label='Clipboard text'
          layout='vertical'
        >
          <Textarea
            value={text}
            rows={5}
            disabled={pending}
            onChange={event => setText(event.target.value)}
          />
        </FormField>
        <DialogFooter>
          <MutationButton
            variant='secondary'
            disabled={pending}
            pending={pending && operation === 'read'}
            pendingLabel='Reading…'
            onClick={() => run('read')}
          >
            Read from device
          </MutationButton>
          <CopyButton
            size='md'
            variant='secondary'
            value={text}
            label='Copy text'
            disabled={pending || !text}
          />
          <MutationButton
            disabled={pending}
            pending={pending && operation === 'send'}
            pendingLabel='Sending…'
            onClick={() => run('send')}
          >
            Send to device
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
