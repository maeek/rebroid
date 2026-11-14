'use client'

import { IconLoader2, IconRoute } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { adHocAiRunPrompt, finalAiRunEvent } from '@/shared/model/ad-hoc-ai-run-events'
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
  const finalEvent = finalAiRunEvent(turn.events)
  const finalResponse = finalEvent?.message ?? ''
  const canSave =
    turn.status === 'success' &&
    Boolean(turn.run && adHocAiRunPrompt(turn.events) && finalEvent?.data.completed === true)
  if (!finalResponse && !canSave) return null

  return (
    <div className='flex flex-wrap justify-end gap-1 pt-1'>
      {finalResponse ? (
        <CopyButton
          value={finalResponse}
          className='text-foreground-muted'
        />
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
          {isSavingWorkflow ? 'Drafting…' : 'Draft workflow'}
        </Button>
      ) : null}
    </div>
  )
}
