'use client'

import { useState, useTransition } from 'react'
import { IconClipboard } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Textarea } from '@/components/ui/textarea'
import { runtimeActionErrorToast } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tools-panel.utils'
import { toast } from '@/hooks/use-toast'
import {
  getApplicationClipboardAction,
  setApplicationClipboardAction
} from '@/server/orchestrator/applications/actions/runtime/clipboard-actions'

export const ViewerClipboard = ({ appId }: { appId: string }) => {
  const [text, setText] = useState('')
  const [operation, setOperation] = useState<'read' | 'send' | 'copy'>('read')
  const [pending, startTransition] = useTransition()

  const run = (next: typeof operation) => {
    setOperation(next)
    startTransition(async () => {
      try {
        if (next === 'copy') {
          await navigator.clipboard.writeText(text)
          toast({ title: 'Copied to browser clipboard', variant: 'success' })
          return
        }

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
          size='icon-md'
          variant='secondary'
          className='size-6'
          aria-label='Device clipboard'
          title='Device clipboard'
        >
          <IconClipboard className='size-3.5' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Device clipboard</DialogTitle>
          <DialogDescription>Read text from Android or send text to its clipboard.</DialogDescription>
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
        <DialogFooter className='flex-wrap'>
          <MutationButton
            variant='secondary'
            disabled={pending}
            pending={pending && operation === 'read'}
            pendingLabel='Reading…'
            onClick={() => run('read')}
          >
            Read from device
          </MutationButton>
          <MutationButton
            variant='secondary'
            disabled={pending || !text}
            pending={pending && operation === 'copy'}
            pendingLabel='Copying…'
            onClick={() => run('copy')}
          >
            Copy text
          </MutationButton>
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
