'use client'

import { useState } from 'react'
import { IconCheck, IconCopy, IconLoader2, IconRoute } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import type { ChatTurn } from './ai-agent-chat-utils'

export const ChatTurnSaveWorkflowAction = ({
  isSavingWorkflow,
  onSaveWorkflow,
  turn
}: {
  isSavingWorkflow?: boolean
  onSaveWorkflow?: (turn: ChatTurn) => void
  turn: ChatTurn
}) => {
  const [copied, setCopied] = useState(false)
  const finalResponse = [...turn.events].reverse().find(event => event.type === 'ai.message.completed')?.message ?? ''
  const canSave = turn.status === 'success' && Boolean(turn.run)
  if (!finalResponse && !canSave) return null

  const copyResponse = async () => {
    if (!finalResponse || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(finalResponse)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className='flex flex-wrap justify-end gap-1 pt-1'>
      {finalResponse ? (
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className='text-foreground-muted'
          onClick={() => void copyResponse()}
        >
          {copied ? <IconCheck className='size-4 text-success' /> : <IconCopy className='size-4' />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      ) : null}
      {canSave ? (
        <Button
          type='button'
          size='sm'
          variant='secondary'
          disabled={isSavingWorkflow}
          onClick={() => onSaveWorkflow?.(turn)}
        >
          {isSavingWorkflow ? <IconLoader2 className='size-4 animate-spin' /> : <IconRoute className='size-4' />}
          {isSavingWorkflow ? 'Drafting' : 'Save as workflow'}
        </Button>
      ) : null}
    </div>
  )
}
