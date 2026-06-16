import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatTurnView } from './ai-agent-chat-events'
import type { ChatTurn } from './ai-agent-chat-utils'
import type { RefObject } from 'react'

const AiAgentTranscriptSkeleton = () => (
  <div
    aria-label='Loading AI chat history'
    className='grid gap-3'
  >
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        key={index}
        className='grid gap-2 rounded-lg border border-border/60 bg-surface-band/35 p-3'
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

const AiAgentEmptyTranscript = () => (
  <div className='flex min-h-40 flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/20 p-6 text-center'>
    <div className='grid max-w-sm place-items-center gap-3'>
      <div className='flex size-10 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary'>
        <GradientSparklesIcon className='size-5' />
      </div>
      <div className='grid gap-1'>
        <div className='flex items-center justify-center gap-2 text-sm font-medium'>
          <GradientSparklesIcon className='size-4' />
          AI agent ready
        </div>
        <p className='text-xs text-foreground-muted'>Ready while the display connects.</p>
      </div>
    </div>
  </div>
)

export const AiAgentTranscript = ({
  canSaveWorkflow,
  draftingRunId,
  isLoadingHistory,
  onSaveWorkflow,
  onTranscriptScroll,
  transcriptRef,
  turns
}: {
  canSaveWorkflow: boolean
  draftingRunId: string | null
  isLoadingHistory: boolean
  onSaveWorkflow: (turn: ChatTurn) => void
  onTranscriptScroll: () => void
  transcriptRef: RefObject<HTMLDivElement | null>
  turns: ChatTurn[]
}) => (
  <div
    ref={transcriptRef}
    aria-label='AI agent transcript'
    className='flex min-h-0 max-h-[min(46dvh,26rem)] flex-1 flex-col gap-4 overflow-y-auto pb-2 pr-1 motion-safe:scroll-smooth md:max-h-none'
    onScroll={onTranscriptScroll}
  >
    {isLoadingHistory ? <AiAgentTranscriptSkeleton /> : null}
    {!isLoadingHistory && turns.length === 0 ? <AiAgentEmptyTranscript /> : null}
    {!isLoadingHistory
      ? turns.map(turn => (
          <ChatTurnView
            key={turn.id}
            turn={turn}
            canSaveWorkflow={canSaveWorkflow}
            isSavingWorkflow={draftingRunId === turn.run?.id}
            onSaveWorkflow={onSaveWorkflow}
          />
        ))
      : null}
  </div>
)
