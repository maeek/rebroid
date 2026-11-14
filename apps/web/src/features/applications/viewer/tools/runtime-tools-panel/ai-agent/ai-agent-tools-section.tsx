'use client'

import { useMemo, useRef } from 'react'
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react'
import { catalogByRole, selectCatalogProviderAndModel } from '@/shared/model/ai-model-catalog'
import { AiComposerActions } from '@/shared/ui/ai/ai-composer-actions'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import {
  AiAgentConversationLayout,
  AiAgentConversationToolbar,
  AiAgentPromptSuggestions,
  AiAgentSuggestionsMenu
} from './ai-agent-conversation-layout'
import { aiAgentPromptPresets } from './ai-agent-prompt-presets'
import { AiAgentSettingsPopover } from './ai-agent-settings-popover'
import { AiAgentTranscript } from './ai-agent-transcript'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import { useAiAgentConversationExport } from './use-ai-agent-conversation-export'
import { useAiAgentPromptSuggestions, type GeneratePromptSuggestions } from './use-ai-agent-prompt-suggestions'
import { useAiAgentWorkflowDraft, type DraftWorkflowFromRun } from './use-ai-agent-workflow-draft'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun } from '@/shared/contracts/automation'

type AiAgentToolsSectionProps = {
  app: AppDefinition
  canSaveWorkflow?: boolean
  className?: string
  contextualSuggestionsEnabled?: boolean
  draftWorkflowFromRun?: DraftWorkflowFromRun
  generatePromptSuggestions?: GeneratePromptSuggestions
  openWorkflowDraft?: () => void
  onRunStarted?: (run: AutomationRun) => void
}

export const AiAgentToolsSection = (props: AiAgentToolsSectionProps) => {
  const session = useAiAgentChatSession({ app: props.app, onRunStarted: props.onRunStarted })
  return (
    <AiAgentConversation
      {...props}
      session={session}
    />
  )
}

export const AiAgentConversation = ({
  app,
  canSaveWorkflow = false,
  className,
  contextualSuggestionsEnabled = true,
  draftWorkflowFromRun,
  generatePromptSuggestions,
  openWorkflowDraft,
  session
}: AiAgentToolsSectionProps & { session: ReturnType<typeof useAiAgentChatSession> }) => {
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fallbackSuggestions = useMemo(() => aiAgentPromptPresets(app), [app])
  const {
    activeTurn,
    adHocTimeoutMinutes,
    adHocTimeoutMs,
    canSubmit,
    canRunQueuedTurn,
    cancelRun,
    catalog,
    clearConversation,
    error,
    health,
    isCanceling,
    isCheckingHealth,
    isClearing,
    isLoadingHistory,
    isAtBottom,
    primaryCatalog,
    prompt,
    queuedTurn,
    onTranscriptScroll,
    scrollToLatest,
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
    submissionFeedback,
    submit,
    submitPrompt,
    timeoutMinutesInput,
    transcriptRef,
    turns,
    visionCatalog
  } = session

  const preferredPlanningModelId = selectedModel?.roles.includes('planner') ? selectedModel.id : ''
  const planning = useMemo(
    () =>
      selectCatalogProviderAndModel(
        catalogByRole(catalog, 'planner'),
        selectedProvider?.id ?? '',
        preferredPlanningModelId,
        'planner'
      ),
    [catalog, selectedProvider?.id, preferredPlanningModelId]
  )

  const suggestions = useAiAgentPromptSuggestions({
    activeTurn,
    app,
    contextualSuggestionsEnabled,
    fallbackSuggestions,
    generatePromptSuggestions,
    selectedModel: planning.model,
    selectedProvider: planning.provider,
    turns
  })

  const { draftingRunId, saveTurnAsWorkflow } = useAiAgentWorkflowDraft({
    draftWorkflowFromRun,
    openWorkflowDraft,
    selectedModel: planning.model,
    selectedProvider: planning.provider,
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
    composerRef.current?.focus({ preventScroll: true })
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

  const sendMessage = () => {
    if (!app.running || !canSubmit) return
    composerRef.current?.focus({ preventScroll: true })
    void submit()
  }

  const modelBlocker = !selectedProvider || !selectedModel ? selectionMessage : null
  const deviceBlocker = !app.running ? 'The app must be running to send or run a queued task.' : null

  let secondaryAction
  if (queuedTurn && !activeTurn) {
    secondaryAction = {
      label: 'Run next task',
      icon: (
        <IconPlayerPlay
          aria-hidden
          className='size-4'
        />
      ),
      disabled: !canRunQueuedTurn,
      onClick: () => void runQueuedTurn()
    }
  }
  if (showCancelRun) {
    const canceling = isCanceling || activeTurn?.status === 'canceling'
    secondaryAction = {
      label: canceling ? 'Canceling' : 'Stop',
      icon: (
        <IconPlayerStop
          aria-hidden
          className='size-4'
        />
      ),
      pending: canceling,
      onClick: () => void cancelRun()
    }
  }

  return (
    <AiAgentConversationLayout
      className={className}
      toolbar={
        <AiAgentConversationToolbar
          hasTurns={turns.length > 0}
          loading={isLoadingHistory}
          isClearing={isClearing}
          onExport={exportConversation}
          onClear={() => void clearConversation()}
        />
      }
      transcript={
        <AiAgentTranscript
          canSaveWorkflow={canSaveWorkflow && Boolean(planning.provider && planning.model && draftWorkflowFromRun)}
          draftingRunId={draftingRunId}
          isLoadingHistory={isLoadingHistory}
          onApproveEscalation={approveEscalation}
          onSaveWorkflow={completedTurn => void saveTurnAsWorkflow(completedTurn)}
          onTranscriptScroll={onTranscriptScroll}
          transcriptRef={transcriptRef}
          isAtBottom={isAtBottom}
          onScrollToLatest={scrollToLatest}
          turns={turns}
          activeTask={Boolean(activeTurn)}
          nextQueuedId={queuedTurn?.id}
          canRunQueuedTurn={canRunQueuedTurn}
          suggestions={
            <AiAgentPromptSuggestions
              suggestions={suggestions}
              onSelect={applyPreset}
            />
          }
        />
      }
      composer={
        <div className='grid gap-2'>
          {deviceBlocker || modelBlocker ? (
            <div
              role='status'
              className='grid gap-1 text-xs text-foreground-muted'
            >
              {deviceBlocker ? <p>{deviceBlocker}</p> : null}
              {modelBlocker ? <p>{modelBlocker}</p> : null}
            </div>
          ) : null}
          <AiPromptComposer
            value={prompt}
            rows={2}
            ariaLabel='Message the device agent'
            textareaRef={composerRef}
            placeholder={app.running ? 'Describe a task for this Android device…' : 'Draft a task…'}
            status={submissionFeedback}
            leadingControl={
              <AiAgentSuggestionsMenu
                suggestions={suggestions}
                onSelect={applyPreset}
              />
            }
            errors={[selectedProvider && selectedModel ? selectionMessage : null, error]}
            onChange={setPrompt}
            onSubmit={sendMessage}
            submitOnEnter
            modelControl={
              <div className='flex min-w-0 flex-wrap items-center gap-1'>
                <AiAgentSettingsPopover
                  adHocTimeoutMinutes={adHocTimeoutMinutes}
                  catalog={primaryCatalog}
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
            }
            actions={
              <AiComposerActions
                label={activeTurn || queuedTurn ? 'Queue message' : 'Send message'}
                disabled={!app.running || !canSubmit}
                pending={activeTurn?.status === 'starting' && !prompt.trim()}
                accepted={Boolean(submissionFeedback) && !prompt.trim()}
                onSubmit={sendMessage}
                secondaryAction={secondaryAction}
              />
            }
          />
        </div>
      }
    />
  )
}
