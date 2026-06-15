'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { IconDownload, IconPlayerPlay, IconPlayerStop, IconSend, IconTrash } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { storePendingAutomationDraft } from '@/features/automations/automations-page/editor/pending-automation-draft'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { AiPromptComposer } from '@/shared/ui/ai/ai-prompt-composer'
import { ChatTurnView } from './ai-agent-chat-events'
import { conversationBeforeTurn, terminalRunStatuses, type ChatTurn } from './ai-agent-chat-utils'
import { aiAgentPromptPresets } from './ai-agent-prompt-presets'
import { AiAgentSettingsPopover } from './ai-agent-settings-popover'
import { useAiAgentChatSession } from './use-ai-agent-chat-session'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type {
  AiPromptSuggestion,
  AutomationRun,
  AutomationYamlDraft,
  SuggestAdHocAiPromptsInput
} from '@/server/orchestrator/automations/types'

type DraftWorkflowFromRun = (input: {
  runId: string
  providerId?: string
  modelId?: string
  visionProviderId?: string
  visionModelId?: string
}) => Promise<AutomationYamlDraft>

type GeneratePromptSuggestions = (input: SuggestAdHocAiPromptsInput) => Promise<{ suggestions: AiPromptSuggestion[] }>

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
  const [draftingRunId, setDraftingRunId] = useState<string | null>(null)
  const fallbackSuggestions = useMemo(() => aiAgentPromptPresets(app), [app.id, app.name])
  const [suggestions, setSuggestions] = useState<AiPromptSuggestion[]>(fallbackSuggestions)
  const turnsRef = useRef<ChatTurn[]>([])
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

  useEffect(() => {
    turnsRef.current = turns
  }, [turns])

  const terminalTurnsKey = useMemo(
    () =>
      turns
        .filter(turn => !turn.run || terminalRunStatuses.has(turn.run.status))
        .map(turn => `${turn.id}:${turn.status}:${turn.events.at(-1)?.sequence ?? 0}`)
        .join('|'),
    [turns]
  )

  useEffect(() => {
    if (!contextualSuggestionsEnabled || !generatePromptSuggestions || !selectedProvider || !selectedModel) {
      setSuggestions(fallbackSuggestions)
      return
    }
    if (activeTurn) return

    let cancelled = false
    const currentTurns = turnsRef.current
    const recentEvents = currentTurns
      .flatMap(turn => turn.events)
      .filter(event => event.message.trim().length > 0)
      .slice(-20)
      .map(event => ({ type: event.type, message: event.message }))

    void generatePromptSuggestions({
      targetApplicationId: app.id,
      appName: app.name,
      profileMode: app.profileMode,
      profileName: app.profileName,
      conversation: conversationBeforeTurn('__suggestions__', currentTurns),
      recentEvents,
      providerId: selectedProvider.id,
      modelId: selectedModel.id
    })
      .then(result => {
        if (cancelled || result.suggestions.length === 0) return
        setSuggestions(result.suggestions)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [
    activeTurn,
    app.id,
    app.name,
    app.profileMode,
    app.profileName,
    contextualSuggestionsEnabled,
    fallbackSuggestions,
    generatePromptSuggestions,
    selectedModel,
    selectedProvider,
    terminalTurnsKey
  ])

  const applyPreset = (presetPrompt: string) => {
    setPrompt(current => (current.trim() ? `${current.trim()}\n\n${presetPrompt}` : presetPrompt))
  }

  const saveTurnAsWorkflow = async (turn: ChatTurn) => {
    if (!turn.run || !selectedProvider || !selectedModel || !draftWorkflowFromRun || draftingRunId) return
    setDraftingRunId(turn.run.id)
    try {
      const draft = await draftWorkflowFromRun({
        runId: turn.run.id,
        providerId: selectedProvider.id,
        modelId: selectedModel.id,
        ...(selectedVisionProvider && selectedVisionModel
          ? {
              visionProviderId: selectedVisionProvider.id,
              visionModelId: selectedVisionModel.id
            }
          : {})
      })
      storePendingAutomationDraft({ yaml: draft.yaml, sourceRunId: turn.run.id })
      if (openWorkflowDraft) {
        openWorkflowDraft()
      } else {
        window.location.href = '/automations/create'
      }
    } catch (draftError) {
      toast({
        title: 'Could not draft workflow',
        description: draftError instanceof Error ? draftError.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setDraftingRunId(null)
    }
  }

  const exportConversation = () => {
    const currentTurns = turnsRef.current
    if (currentTurns.length === 0) return
    try {
      const exportedAt = new Date().toISOString()
      const payload = {
        exportedAt,
        app: {
          id: app.id,
          name: app.name,
          profileMode: app.profileMode,
          profileName: app.profileName,
          status: app.status,
          lifecycleStage: app.lifecycleStage
        },
        planner: selectedProvider && selectedModel ? { provider: selectedProvider, model: selectedModel } : null,
        vision:
          selectedVisionProvider && selectedVisionModel
            ? { provider: selectedVisionProvider, model: selectedVisionModel }
            : null,
        sharedMultimodalMode: Boolean(
          selectedProvider &&
          selectedModel &&
          selectedVisionProvider &&
          selectedVisionModel &&
          selectedProvider.id === selectedVisionProvider.id &&
          selectedModel.id === selectedVisionModel.id &&
          selectedModel.roles.includes('vision')
        ),
        timeoutMs: adHocTimeoutMs,
        turns: currentTurns
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const safeAppName =
        app.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || app.id
      link.href = url
      link.download = `rebroid-ai-conversation-${safeAppName}-${exportedAt.replace(/[:.]/g, '-')}.json`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      toast({
        title: 'Could not export conversation',
        description: exportError instanceof Error ? exportError.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }

  return (
    <section className={cn('flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4', className)}>
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
                canSaveWorkflow={canSaveWorkflow && Boolean(selectedProvider && selectedModel && draftWorkflowFromRun)}
                isSavingWorkflow={draftingRunId === turn.run?.id}
                onSaveWorkflow={completedTurn => {
                  void saveTurnAsWorkflow(completedTurn)
                }}
              />
            ))
          : null}
      </div>

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
                  onClick={exportConversation}
                >
                  <IconDownload className='size-4' />
                  Export
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
      </div>
    </section>
  )
}
