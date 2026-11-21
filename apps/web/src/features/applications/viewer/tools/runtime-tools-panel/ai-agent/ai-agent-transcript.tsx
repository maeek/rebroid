import type { ReactNode, RefObject } from 'react'
import { IconArrowDown } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatTurnView } from './ai-agent-chat-events'
import type { ChatTurn } from './ai-agent-chat-utils'

const AiAgentTranscriptSkeleton = () => (
  <div
    aria-label='Loading AI chat history'
    className='grid gap-3'
  >
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        key={index}
        className='grid gap-3 py-4'
      >
        <div className='flex items-center gap-2'>
          <Skeleton className='size-6 rounded-full' />
          <Skeleton className='h-3 w-28' />
        </div>
        <Skeleton className='h-3 w-full' />
        <Skeleton className='h-3 w-4/5' />
      </div>
    ))}
  </div>
)

const AiAgentEmptyTranscript = ({ suggestions }: { suggestions?: ReactNode }) => (
  <div className='flex min-h-48 flex-1 items-center justify-center py-6 text-center'>
    <div className='grid max-w-lg place-items-center gap-4'>
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
  <div className='relative flex min-h-0 flex-1 flex-col'>
    <div
      ref={transcriptRef}
      aria-label='AI agent transcript'
      role='region'
      // This scroll region must be reachable for keyboard scrolling.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className='scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto transform-gpu rounded-control py-4 focus-visible:outline-2 focus-visible:outline-ring'
      onScroll={onTranscriptScroll}
    >
      <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-1'>
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
      </div>
    </div>
    {!isAtBottom && onScrollToLatest ? (
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
    ) : null}
  </div>
)
