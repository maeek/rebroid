import type { RefObject } from 'react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
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
        className='grid gap-2 rounded-panel border border-surface-border/50 bg-surface-band/25 p-4'
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
  <div className='flex min-h-56 flex-1 items-center justify-center p-6 text-center'>
    <div className='grid max-w-sm place-items-center gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300'>
      <div className='relative flex size-12 items-center justify-center rounded-feature border border-primary/20 bg-primary/8 text-primary shadow-[0_16px_40px_-24px_hsl(var(--primary)/0.85)]'>
        <span className='absolute inset-0 rounded-feature bg-primary/8 motion-safe:animate-ping motion-safe:[animation-duration:2.8s]' />
        <GradientSparklesIcon className='relative size-5' />
      </div>
      <div className='grid gap-1'>
        <div className='text-sm font-medium'>What should I do on this device?</div>
        <p className='text-xs leading-5 text-foreground-muted'>
          Describe an outcome. The agent will inspect the screen, make a plan when needed, and verify each action.
        </p>
      </div>
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
  turns
}: {
  canSaveWorkflow: boolean
  draftingRunId: string | null
  isLoadingHistory: boolean
  onApproveEscalation: (program: string) => void
  onSaveWorkflow: (turn: ChatTurn) => void
  onTranscriptScroll: () => void
  transcriptRef: RefObject<HTMLDivElement | null>
  turns: ChatTurn[]
}) => (
  <div
    ref={transcriptRef}
    aria-label='AI agent transcript'
    className='scrollbar-thin flex min-h-0 max-h-[min(46dvh,26rem)] flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 motion-safe:scroll-smooth md:max-h-none'
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
            onApproveEscalation={onApproveEscalation}
            onSaveWorkflow={onSaveWorkflow}
          />
        ))
      : null}
  </div>
)
