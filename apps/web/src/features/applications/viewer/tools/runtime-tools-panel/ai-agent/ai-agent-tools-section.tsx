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

  return (
    <section
      className={cn('flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4', className)}
      data-testid='ai-agent-tools-section'
    >
      {hideHeader ? null : (
        <div className='flex items-center gap-2'>
          <GradientSparklesIcon className='size-4' />
          <div>
            <h3 className='text-sm font-semibold'>AI agent</h3>
            <p className='text-xs text-foreground-muted'>Run a session-only Android automation chat.</p>
          </div>
        </div>
      )}

      <AiAgentTranscript
        canSaveWorkflow={canSaveWorkflow && Boolean(selectedProvider && selectedModel && draftWorkflowFromRun)}
        draftingRunId={draftingRunId}
        isLoadingHistory={isLoadingHistory}
        onSaveWorkflow={completedTurn => {
          void saveTurnAsWorkflow(completedTurn)
        }}
        onTranscriptScroll={onTranscriptScroll}
        transcriptRef={transcriptRef}
        turns={turns}
      />

      <div className='grid shrink-0 gap-3'>
        <div className='flex flex-wrap gap-2 justify-end'>
          {suggestions.map(preset => (
            <Button
              key={preset.id}
              type='button'
              size='sm'
              variant='ghost'
              className='max-w-[18rem] justify-start overflow-hidden text-ellipsis rounded-full px-3 font-normal text-foreground-muted hover:text-foreground'
              title={preset.label}
              onClick={() => applyPreset(preset.prompt)}
            >
              {preset.label}
            </Button>
          ))}
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
                  variant='ghost'
                  onClick={() => void runQueuedTurn()}
                >
                  <IconPlayerPlay className='size-4' />
                  Run next
                </Button>
              ) : null}
              {turns.length > 0 ? (
                <Button
                  type='button'
                  variant='ghost'
                  onClick={exportConversation}
                >
                  <IconDownload className='size-4' />
                  Export
                </Button>
              ) : null}
              {turns.length > 0 ? (
                <Button
                  type='button'
                  variant='ghost'
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
      </div>
    </section>
  )
}
