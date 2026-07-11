'use client'

import { useMemo } from 'react'
import { IconDownload, IconPlayerPlay, IconPlayerStop, IconSend, IconTrash } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import { aiAgentPromptPresets } from './ai-agent-prompt-presets'
import { AiAgentSettingsPopover } from './ai-agent-settings-popover'
import { AiAgentTranscript } from './ai-agent-transcript'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import { useAiAgentConversationExport } from './use-ai-agent-conversation-export'
import { useAiAgentPromptSuggestions, type GeneratePromptSuggestions } from './use-ai-agent-prompt-suggestions'
import { useAiAgentWorkflowDraft, type DraftWorkflowFromRun } from './use-ai-agent-workflow-draft'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun } from '@/server/orchestrator/automations/types'

export const AiAgentToolsSection = ({
  app,
  canSaveWorkflow = false,
  className,
  contextualSuggestionsEnabled = true,
  draftWorkflowFromRun,
  generatePromptSuggestions,
  hideHeader,
  openWorkflowDraft,
  onRunStarted
}: {
  app: AppDefinition
  canSaveWorkflow?: boolean
  className?: string
  contextualSuggestionsEnabled?: boolean
  draftWorkflowFromRun?: DraftWorkflowFromRun
  generatePromptSuggestions?: GeneratePromptSuggestions
  hideHeader?: boolean
  openWorkflowDraft?: () => void
  onRunStarted?: (run: AutomationRun) => void
}) => {
  const fallbackSuggestions = useMemo(() => aiAgentPromptPresets(app), [app])
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
    onTranscriptScroll,
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
    submitPrompt,
    timeoutMinutesInput,
    transcriptRef,
    turns,
    visionCatalog
  } = useAiAgentChatSession({ app, onRunStarted })

  const suggestions = useAiAgentPromptSuggestions({
    activeTurn,
    app,
    contextualSuggestionsEnabled,
    fallbackSuggestions,
    generatePromptSuggestions,
    selectedModel,
    selectedProvider,
    turns
  })

  const { draftingRunId, saveTurnAsWorkflow } = useAiAgentWorkflowDraft({
    draftWorkflowFromRun,
    openWorkflowDraft,
    selectedModel,
    selectedProvider,
    selectedVisionModel,
    selectedVisionProvider
  })

  const exportConversation = useAiAgentConversationExport({
    adHocTimeoutMs,
    app,
    selectedModel,
    selectedProvider,
    selectedVisionModel,
    selectedVisionProvider,
    turns
  })

  const applyPreset = (presetPrompt: string) => {
    setPrompt(current => (current.trim() ? `${current.trim()}\n\n${presetPrompt}` : presetPrompt))
  }

  const approveEscalation = (program: string) => {
    if (!app.running) return
    void submitPrompt(
      [
        `Continue the previous task. I approve one read-only ${program} diagnostic if it is still required.`,
        'Use typed capabilities whenever possible and verify the result.'
      ].join(' '),
      { rawShellPolicy: 'allowlisted' }
    )
  }

  return (
    <section
      className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background', className)}
      data-testid='ai-agent-tools-section'
    >
      {hideHeader ? null : (
        <div className='flex min-h-12 items-center justify-between gap-3 border-b border-surface-border/55 px-4 py-2'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <span className='flex size-8 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/8 text-primary'>
              <GradientSparklesIcon className='size-4' />
            </span>
            <div className='min-w-0'>
              <h3 className='truncate text-sm font-medium'>Device agent</h3>
              <p className='truncate text-xs text-foreground-muted'>Grounded actions · verified results</p>
            </div>
          </div>
          <div className='flex items-center gap-1'>
            {turns.length > 0 ? (
              <Button
                type='button'
                size='icon-md'
                variant='ghost'
                className='size-8 text-foreground-muted'
                aria-label='Export conversation'
                title='Export conversation'
                onClick={exportConversation}
              >
                <IconDownload className='size-4' />
              </Button>
            ) : null}
            {turns.length > 0 ? (
              <Button
                type='button'
                size='icon-md'
                variant='ghost'
                className='size-8 text-foreground-muted hover:text-danger'
                aria-label={isClearing ? 'Clearing conversation' : 'Clear conversation'}
                title='Clear conversation'
                disabled={isClearing}
                onClick={() => void clearConversation()}
              >
                <IconTrash className='size-4' />
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <AiAgentTranscript
        canSaveWorkflow={canSaveWorkflow && Boolean(selectedProvider && selectedModel && draftWorkflowFromRun)}
        draftingRunId={draftingRunId}
        isLoadingHistory={isLoadingHistory}
        onApproveEscalation={approveEscalation}
        onSaveWorkflow={completedTurn => {
          void saveTurnAsWorkflow(completedTurn)
        }}
        onTranscriptScroll={onTranscriptScroll}
        transcriptRef={transcriptRef}
        turns={turns}
      />

      <div
        className='grid shrink-0 gap-2 border-t border-surface-border/50 bg-transparent px-4 pt-3 pb-4'
        data-testid='ai-agent-composer-dock'
      >
        {!app.running ? (
          <div
            role='status'
            className='flex items-start gap-2.5 rounded-panel border border-warning/30 bg-warning/8 px-3 py-2.5 text-xs text-foreground-muted'
          >
            <span className='mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-panel bg-warning/12 text-warning'>
              <IconPlayerPlay className='size-3.5' />
            </span>
            <div className='grid gap-0.5'>
              <span className='font-medium text-foreground'>Device actions are paused</span>
              <span>
                Review history, configure the model, or draft the next request. Start {app.name} when ready to send.
              </span>
            </div>
          </div>
        ) : null}
        <div className='scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5'>
          {suggestions.map(preset => (
            <Button
              key={preset.id}
              type='button'
              size='sm'
              variant='ghost'
              className='max-w-[18rem] shrink-0 justify-start overflow-hidden text-ellipsis rounded-full border border-surface-border/45 bg-surface-band/18 px-3 font-normal text-foreground-muted shadow-none hover:border-surface-border hover:bg-surface-band/55 hover:text-foreground'
              title={preset.label}
              onClick={() => applyPreset(preset.prompt)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <AiPromptComposer
          value={prompt}
          rows={3}
          placeholder={
            app.running ? 'Describe what you want to accomplish…' : 'Draft a request — start the device to send'
          }
          metadata={
            <span>
              {app.running ? (
                <>
                  <span className='hidden sm:inline'>Enter to send · Shift+Enter for a new line · </span>
                  {adHocTimeoutMs / 60000} min limit
                </>
              ) : (
                'Read-only while the device is stopped'
              )}
            </span>
          }
          errors={[selectionMessage, error]}
          onChange={setPrompt}
          onSubmit={() => void submit()}
          submitOnEnter
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
              {hideHeader && turns.length > 0 ? (
                <Button
                  type='button'
                  size='icon-md'
                  variant='ghost'
                  className='size-8 text-foreground-muted'
                  aria-label='Export conversation'
                  title='Export conversation'
                  onClick={exportConversation}
                >
                  <IconDownload className='size-4' />
                </Button>
              ) : null}
              {hideHeader && turns.length > 0 ? (
                <Button
                  type='button'
                  size='icon-md'
                  variant='ghost'
                  className='size-8 text-foreground-muted hover:text-danger'
                  aria-label={isClearing ? 'Clearing conversation' : 'Clear conversation'}
                  title='Clear conversation'
                  disabled={isClearing}
                  onClick={() => void clearConversation()}
                >
                  <IconTrash className='size-4' />
                </Button>
              ) : null}
              {queuedTurn && !activeTurn ? (
                <Button
                  type='button'
                  variant='ghost'
                  disabled={!app.running}
                  onClick={() => void runQueuedTurn()}
                >
                  <IconPlayerPlay className='size-4' />
                  Run next
                </Button>
              ) : null}
              {showCancelRun ? (
                <Button
                  type='button'
                  variant='ghost'
                  disabled={isCanceling || activeTurn?.status === 'canceling'}
                  onClick={() => void cancelRun()}
                >
                  <IconPlayerStop className='size-4' />
                  {isCanceling ? 'Canceling' : 'Cancel'}
                </Button>
              ) : null}
              <Button
                type='button'
                size='icon-md'
                className='size-8 rounded-panel shadow-[0_8px_20px_-12px_hsl(var(--primary)/0.9)]'
                disabled={!app.running || !canSubmit}
                aria-label={activeTurn ? 'Queue message' : 'Send message'}
                onClick={() => void submit()}
              >
                <IconSend className='size-4' />
              </Button>
            </>
          }
        />
      </div>
    </section>
  )
}
