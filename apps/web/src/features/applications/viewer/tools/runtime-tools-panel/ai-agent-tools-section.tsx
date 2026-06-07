'use client'

import { IconPlayerPlay, IconPlayerStop, IconSend, IconSparkles, IconTrash } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ChatTurnView } from './ai-agent-chat-events'
import { AiAgentModelStatus, AiAgentSettingsPopover } from './ai-agent-settings-popover'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun } from '@/server/orchestrator/automations/types'

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
    <section className={cn('grid gap-4 p-4', className)}>
      {hideHeader ? null : (
        <div className='flex items-center gap-2'>
          {health?.status === 'ok' ? (
            <GradientSparklesIcon className='size-4' />
          ) : (
            <IconSparkles className='size-4 text-primary' />
          )}
          <div>
            <h3 className='text-sm font-semibold'>AI agent</h3>
            <p className='text-xs text-secondary-foreground'>Run a session-only Android automation chat.</p>
          </div>
        </div>
      )}

      <div
        ref={transcriptRef}
        className='grid gap-3 overflow-auto pr-1'
      >
        {turns.length === 0 ? (
          <div className='rounded-md border border-dashed border-border/70 p-3 text-sm text-secondary-foreground'>
            Send a message to start an ephemeral AI run. Screenshots, tool calls, and responses appear here.
          </div>
        ) : (
          turns.map(turn => (
            <ChatTurnView
              key={turn.id}
              turn={turn}
            />
          ))
        )}
      </div>

      <div className='grid gap-2'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Label>Message</Label>
          <div className='flex min-w-0 items-center gap-2'>
            <AiAgentModelStatus
              health={health}
              isCheckingHealth={isCheckingHealth}
              selectedModel={selectedModel}
            />
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
          </div>
        </div>
        <Textarea
          value={prompt}
          rows={4}
          placeholder='Ask the AI to inspect the current screen and operate this app.'
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void submit()
            }
          }}
        />
        {selectionMessage ? <div className='text-xs text-destructive'>{selectionMessage}</div> : null}
        {error ? <div className='text-xs text-destructive'>{error}</div> : null}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <span className='text-xs text-secondary-foreground'>
            Each message starts an ephemeral run with a fresh screenshot. Timeout: {adHocTimeoutMs / 60000} minutes.
          </span>
          <div className='flex items-center gap-2'>
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
              disabled={!canSubmit}
              onClick={() => void submit()}
            >
              <IconSend className='size-4' />
              {activeTurn ? 'Queue' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
