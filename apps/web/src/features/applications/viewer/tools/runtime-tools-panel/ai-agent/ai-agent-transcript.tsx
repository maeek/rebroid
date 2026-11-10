import type { ReactNode, RefObject } from 'react'
import { IconArrowDown } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
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
        <h3 className='text-2xl font-medium tracking-tight'>What would you like to do?</h3>
        <p className='text-sm leading-6 text-foreground-muted'>Ask the agent to help with this device.</p>
      </div>
      {suggestions}
    </div>
  </div>
)

export const AiAgentTranscript = ({
  canSaveWorkflow,
  draftingRunId,
  isLoadingHistory,
  onApproveEscalation,
  onSaveWorkflow,
  onTranscriptScroll,
  transcriptRef,
  turns,
  suggestions,
  isAtBottom = true,
  onScrollToLatest
}: {
  canSaveWorkflow: boolean
  draftingRunId: string | null
  isLoadingHistory: boolean
  onApproveEscalation: (program: string) => void
  onSaveWorkflow: (turn: ChatTurn) => void
  onTranscriptScroll: () => void
  transcriptRef: RefObject<HTMLDivElement | null>
  turns: ChatTurn[]
  suggestions?: ReactNode
  isAtBottom?: boolean
  onScrollToLatest?: () => void
}) => (
  <div className='relative flex min-h-0 flex-1 flex-col'>
    <div
      ref={transcriptRef}
      aria-label='AI agent transcript'
      role='region'
      // This scroll region must be reachable for keyboard scrolling.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className='scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto rounded-control py-4 focus-visible:outline-2 focus-visible:outline-ring'
      onScroll={onTranscriptScroll}
    >
      <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-1'>
        {isLoadingHistory ? <AiAgentTranscriptSkeleton /> : null}
        {!isLoadingHistory && turns.length === 0 ? <AiAgentEmptyTranscript suggestions={suggestions} /> : null}
        {!isLoadingHistory
          ? turns.map(turn => (
              <ChatTurnView
                key={turn.id}
                turn={turn}
                canSaveWorkflow={canSaveWorkflow}
                isSavingWorkflow={draftingRunId === turn.run?.id}
                onApproveEscalation={onApproveEscalation}
                onSaveWorkflow={onSaveWorkflow}
              />
            ))
          : null}
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
