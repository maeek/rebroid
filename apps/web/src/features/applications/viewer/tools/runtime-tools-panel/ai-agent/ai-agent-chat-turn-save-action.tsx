import { IconLoader2, IconRoute } from '@tabler/icons-react'
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
  if (turn.status !== 'success' || !turn.run) return null

  return (
    <div className='flex justify-end pt-1'>
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
    </div>
  )
}
