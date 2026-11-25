import type { ReactNode, RefObject } from 'react'
import { IconArrowDown } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { StateIllustration } from '@/shared/ui/state-illustration'
import { ChatTurnView } from './ai-agent-chat-events'
import { AiAgentTranscriptLayout, AiAgentTranscriptSkeleton } from './ai-agent-transcript-layout'
import type { ChatTurn } from './ai-agent-chat-utils'

const AiAgentEmptyTranscript = ({ suggestions }: { suggestions?: ReactNode }) => (
  <div className='flex min-h-48 flex-1 items-center justify-center py-6 text-center'>
    <div className='grid max-w-lg place-items-center gap-4'>
      <StateIllustration
        kind='models'
        size='panel'
      />
      <div className='grid gap-2'>
        <h3 className='text-xl font-medium'>Give the device agent a task</h3>
        <p className='text-sm leading-6 text-foreground-muted'>Try asking what’s on the Android screen.</p>
      </div>
      {suggestions}
    </div>
  </div>
)

export const AiAgentTranscript = ({
  canSaveWorkflow,
  draftingRunId,
  isLoadingHistory,
  historyLoadFailed = false,
  onApproveEscalation,
  onSaveWorkflow,
  onTranscriptScroll,
  transcriptRef,
  turns,
  activeTask = false,
  nextQueuedId,
  canRunQueuedTurn = false,
  suggestions,
  isAtBottom = true,
  onScrollToLatest,
  onRetryHistory
}: {
  canSaveWorkflow: boolean
  draftingRunId: string | null
  isLoadingHistory: boolean
  historyLoadFailed?: boolean
  onApproveEscalation: (program: string) => void
  onSaveWorkflow: (turn: ChatTurn) => void
  onTranscriptScroll: () => void
  transcriptRef: RefObject<HTMLDivElement | null>
  turns: ChatTurn[]
  activeTask?: boolean
  nextQueuedId?: string
  canRunQueuedTurn?: boolean
  suggestions?: ReactNode
  isAtBottom?: boolean
  onScrollToLatest?: () => void
  onRetryHistory?: () => void
}) => (
  <AiAgentTranscriptLayout
    transcriptRef={transcriptRef}
    onTranscriptScroll={onTranscriptScroll}
    scrollAction={
      !isAtBottom && onScrollToLatest ? (
        <div className='pointer-events-none absolute inset-x-0 bottom-2 flex justify-center'>
          <Button
            variant='secondary'
            size='sm'
            className='pointer-events-auto shadow-panel'
            onClick={onScrollToLatest}
          >
            <IconArrowDown className='size-4' />
            Latest messages
          </Button>
        </div>
      ) : null
    }
  >
    {isLoadingHistory ? <AiAgentTranscriptSkeleton /> : null}
    {historyLoadFailed ? (
      <Notice
        tone='warning'
        title='Chat history could not be loaded'
        description={turns.length > 0 ? 'Your pending messages are still here.' : undefined}
        actions={
          onRetryHistory ? (
            <Button
              variant='secondary'
              size='sm'
              onClick={onRetryHistory}
            >
              Retry history
            </Button>
          ) : null
        }
      />
    ) : null}
    {!isLoadingHistory && !historyLoadFailed && turns.length === 0 ? (
      <AiAgentEmptyTranscript suggestions={suggestions} />
    ) : null}
    {turns.map(turn => {
      let queueMessage = 'Queued behind earlier tasks.'
      if (turn.id === nextQueuedId) {
        if (activeTask) queueMessage = 'Queued behind the current task.'
        else if (canRunQueuedTurn) queueMessage = 'Ready to run. Choose Run next task when you’re ready.'
        else queueMessage = 'This task is next in the queue.'
      }
      return (
        <ChatTurnView
          key={turn.id}
          turn={turn}
          queueMessage={queueMessage}
          canSaveWorkflow={canSaveWorkflow}
          isSavingWorkflow={draftingRunId === turn.run?.id}
          onApproveEscalation={onApproveEscalation}
          onSaveWorkflow={onSaveWorkflow}
        />
      )
    })}
  </AiAgentTranscriptLayout>
)
