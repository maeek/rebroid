'use client'

import { IconPlayerPlay, IconPlayerStop, IconSend, IconTrash } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import { ChatTurnView } from './ai-agent-chat-events'
import { AiAgentSettingsPopover } from './ai-agent-settings-popover'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun } from '@/server/orchestrator/automations/types'

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

export const AiAgentToolsSection = ({
  app,
  className,
  hideHeader,
  onRunStarted
}: {
  app: AppDefinition
  className?: string
  hideHeader?: boolean
  onRunStarted?: (run: AutomationRun) => void
}) => {
  const {
    activeTurn,
    adHocTimeoutMinutes,
    adHocTimeoutMs,
    canSubmit,
    cancelRun,
    clearConversation,
    error,
    health,
    isCanceling,
    isCheckingHealth,
    isClearing,
    isLoadingHistory,
    plannerCatalog,
    prompt,
    queuedTurn,
    recheckHealth,
    runQueuedTurn,
    selectedModel,
    selectedProvider,
    selectedVisionModel,
    selectedVisionProvider,
    selectionMessage,
    setModelId,
    setPrompt,
    setProviderId,
    setVisionModelId,
    setVisionProviderId,
    setTimeoutMinutesInput,
    showCancelRun,
    submit,
    timeoutMinutesInput,
    transcriptRef,
    turns,
    visionCatalog
  } = useAiAgentChatSession({ app, onRunStarted })

  return (
    <section className={cn('flex min-h-0 flex-1 flex-col gap-4 p-4', className)}>
      {hideHeader ? null : (
        <div className='flex items-center gap-2'>
          <GradientSparklesIcon className='size-4' />
          <div>
            <h3 className='text-sm font-semibold'>AI agent</h3>
            <p className='text-xs text-foreground-muted'>Run a session-only Android automation chat.</p>
          </div>
        </div>
      )}

      <div
        ref={transcriptRef}
        className='flex min-h-0 max-h-[min(46dvh,26rem)] flex-col gap-4 overflow-auto pb-2 pr-1 motion-safe:scroll-smooth'
      >
        {isLoadingHistory ? <AiAgentTranscriptSkeleton /> : null}
        {!isLoadingHistory && turns.length === 0 ? <AiAgentEmptyTranscript /> : null}
        {!isLoadingHistory
          ? turns.map(turn => (
              <ChatTurnView
                key={turn.id}
                turn={turn}
              />
            ))
          : null}
      </div>

      <AiPromptComposer
        value={prompt}
        rows={4}
        placeholder='Ask the AI to perform a task, call a tool, or take an action...'
        metadata={`Run timeout: ${adHocTimeoutMs / 60000} minutes.`}
        errors={[selectionMessage, error]}
        onChange={setPrompt}
        onSubmit={() => void submit()}
        modelControl={
          <AiAgentSettingsPopover
            adHocTimeoutMinutes={adHocTimeoutMinutes}
            catalog={plannerCatalog}
            health={health}
            isCheckingHealth={isCheckingHealth}
            onRecheckHealth={() => void recheckHealth()}
            selectedModel={selectedModel}
            selectedProvider={selectedProvider}
            selectedVisionModel={selectedVisionModel}
            selectedVisionProvider={selectedVisionProvider}
            setModelId={setModelId}
            setProviderId={setProviderId}
            setVisionModelId={setVisionModelId}
            setVisionProviderId={setVisionProviderId}
            setTimeoutMinutesInput={setTimeoutMinutesInput}
            timeoutMinutesInput={timeoutMinutesInput}
            visionCatalog={visionCatalog}
          />
        }
        actions={
          <>
            {queuedTurn && !activeTurn ? (
              <Button
                type='button'
                variant='secondary'
                onClick={() => void runQueuedTurn()}
              >
                <IconPlayerPlay className='size-4' />
                Run next
              </Button>
            ) : null}
            {turns.length > 0 ? (
              <Button
                type='button'
                variant='secondary'
                disabled={isClearing}
                onClick={() => void clearConversation()}
              >
                <IconTrash className='size-4' />
                {isClearing ? 'Clearing' : 'Clear'}
              </Button>
            ) : null}
            {showCancelRun ? (
              <Button
                type='button'
                variant='secondary'
                disabled={isCanceling || activeTurn?.status === 'canceling'}
                onClick={() => void cancelRun()}
              >
                <IconPlayerStop className='size-4' />
                {isCanceling ? 'Canceling' : 'Cancel'}
              </Button>
            ) : null}
            <Button
              type='button'
              size='icon'
              disabled={!canSubmit}
              aria-label={activeTurn ? 'Queue message' : 'Send message'}
              onClick={() => void submit()}
            >
              <IconSend className='size-4' />
            </Button>
          </>
        }
      />
    </section>
  )
}
