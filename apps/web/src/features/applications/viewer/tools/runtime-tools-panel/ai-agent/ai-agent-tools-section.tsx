'use client'

import { useMemo, useRef } from 'react'
import { IconArrowUp, IconCheck, IconMessagePlus, IconPlayerPlay, IconPlayerStopFilled } from '@tabler/icons-react'
import { catalogByRole, selectCatalogProviderAndModel } from '@/shared/model/ai-model-catalog'
import { AiComposerAction } from '@/shared/ui/ai/ai-composer-action'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import {
  AiAgentConversationLayout,
  AiAgentConversationToolbar,
  AiAgentPromptSuggestions
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
    modelSettings,
    canSubmit,
    canRunQueuedTurn,
    cancelRun,
    clearConversation,
    error,
    historyLoadFailed,
    isCanceling,
    isClearing,
    isLoadingHistory,
    isAtBottom,
    prompt,
    queuedTurn,
    onTranscriptScroll,
    scrollToLatest,
    retryHistory,
    runQueuedTurn,
    setPrompt,
    showCancelRun,
    submissionFeedback,
    submit,
    submitPrompt,
    transcriptRef,
    turns
  } = session
  const {
    adHocTimeoutMs,
    catalog,
    selectedModel,
    selectedProvider,
    selectedVisionModel,
    selectedVisionProvider,
    selectionMessage
  } = modelSettings

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
    visible: !isLoadingHistory && !historyLoadFailed && !activeTurn && turns.length === 0,
    app,
    contextualSuggestionsEnabled,
    fallbackSuggestions,
    generatePromptSuggestions,
    selectedModel: planning.model,
    selectedProvider: planning.provider
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
  const canSendMessage = app.running && canSubmit

  const canceling = isCanceling || activeTurn?.status === 'canceling'
  const starting = activeTurn?.status === 'starting' && !showCancelRun
  const sendLabel =
    queuedTurn || turns.some(turn => turn.status === 'waiting-for-history') ? 'Queue message' : 'Send message'
  let actionLabel = sendLabel
  if (activeTurn) actionLabel = 'Stop'
  if (starting) actionLabel = 'Starting task'
  if (canceling && activeTurn) actionLabel = 'Canceling'
  const SendIcon = submissionFeedback && !prompt.trim() ? IconCheck : IconArrowUp
  const ActionIcon = activeTurn ? IconPlayerStopFilled : SendIcon

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
          historyLoadFailed={historyLoadFailed}
          onRetryHistory={retryHistory}
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
              activeTurn ? (
                <AiComposerAction
                  label='Queue message'
                  shortcut='⌘+Enter / Ctrl+Enter'
                  variant='ghost'
                  size='icon-sm'
                  className='text-foreground-muted'
                  disabled={!canSendMessage}
                  onClick={sendMessage}
                >
                  <IconMessagePlus
                    aria-hidden
                    className='size-4'
                  />
                </AiComposerAction>
              ) : queuedTurn ? (
                <AiComposerAction
                  label='Run next task'
                  variant='ghost'
                  size='icon-sm'
                  disabled={!canRunQueuedTurn}
                  onClick={() => void runQueuedTurn()}
                >
                  <IconPlayerPlay
                    aria-hidden
                    className='size-4'
                  />
                </AiComposerAction>
              ) : null
            }
            errors={[selectedProvider && selectedModel ? selectionMessage : null, error]}
            onChange={setPrompt}
            onSubmit={sendMessage}
            submitOnEnter={!activeTurn}
            modelControl={<AiAgentSettingsPopover settings={modelSettings} />}
            actions={
              <AiComposerAction
                label={actionLabel}
                disabled={activeTurn ? !showCancelRun : !canSendMessage}
                pending={Boolean(activeTurn && (starting || canceling))}
                onClick={activeTurn ? () => void cancelRun() : sendMessage}
              >
                <ActionIcon
                  aria-hidden
                  className='size-4'
                />
              </AiComposerAction>
            }
          />
        </div>
      }
    />
  )
}
