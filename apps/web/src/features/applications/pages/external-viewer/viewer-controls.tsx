'use client'

import { useState } from 'react'
import { CopyButton } from '@/components/ui/copy-button'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Textarea } from '@/components/ui/textarea'

const androidControls = [
  { command: 'back', label: 'Back' },
  { command: 'home', label: 'Home' },
  { command: 'recents', label: 'Recent apps' }
]

export function ExternalViewerControls({
  sessionId,
  canControl,
  canClipboard,
  clipboard,
  onClipboardChange,
  onReadClipboard
}: {
  sessionId: string
  canControl: boolean
  canClipboard: boolean
  clipboard: string
  onClipboardChange: (text: string) => void
  onReadClipboard: () => void
}) {
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const request = async (operation: string, path: 'actions' | 'clipboard', body: Record<string, string>) => {
    if (pending) return
    setPending(operation)
    setError('')
    try {
      if (operation === 'read') onReadClipboard()
      const route = `/external-display/rebroid/display/public/sessions/${encodeURIComponent(sessionId)}`
      const response = await fetch(`${route}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6_000)
      })
      if (!response.ok) throw new Error('Viewer operation failed.')
    } catch {
      setError('The live viewer could not complete the action. Check the connection and try again.')
    } finally {
      setPending('')
    }
  }

  return (
    <>
      {error ? <Notice tone='danger'>{error}</Notice> : null}
      {canControl ? (
        <div
          className='flex flex-wrap gap-2'
          role='group'
          aria-label='Android navigation'
        >
          {androidControls.map(({ command, label }) => (
            <MutationButton
              key={command}
              variant='outline'
              pending={pending === command}
              pendingLabel='Sending…'
              disabled={Boolean(pending)}
              onClick={() => void request(command, 'actions', { command })}
            >
              {label}
            </MutationButton>
          ))}
        </div>
      ) : null}
      {canClipboard ? (
        <Section
          title='Clipboard'
          surface='panel'
        >
          <FormField
            label='Clipboard text'
            layout='vertical'
          >
            <Textarea
              name='clipboard'
              value={clipboard}
              maxLength={64 * 1024}
              onChange={event => onClipboardChange(event.target.value)}
            />
          </FormField>
          <div className='flex flex-wrap gap-2'>
            <MutationButton
              variant='outline'
              pending={pending === 'read'}
              pendingLabel='Reading…'
              disabled={Boolean(pending)}
              onClick={() => void request('read', 'clipboard', { action: 'read' })}
            >
              Read device clipboard
            </MutationButton>
            <MutationButton
              variant='outline'
              pending={pending === 'write'}
              pendingLabel='Sending…'
              disabled={Boolean(pending) || !clipboard}
              onClick={() => void request('write', 'clipboard', { action: 'write', text: clipboard })}
            >
              Send to device
            </MutationButton>
            <CopyButton
              aria-label='Copy clipboard text'
              value={clipboard}
              disabled={!clipboard}
            />
          </div>
        </Section>
      ) : null}
    </>
  )
}
