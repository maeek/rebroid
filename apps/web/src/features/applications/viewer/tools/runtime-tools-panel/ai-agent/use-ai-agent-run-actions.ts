import { useCallback, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import {
  cancelAutomationRunAction,
  clearAdHocAiAutomationRunsAction,
  runAdHocAiAutomationAction
} from '@/server/orchestrator/automations/automation-run-actions'
import { createPromptTurn } from './ai-agent-chat-session-model'
import {
  activeRunStatuses,
  conversationBeforeTurn,
  type ChatConversationMessage,
  type ChatTurn,
  type ChatTurnStatus
} from './ai-agent-chat-utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'
import type { AutomationRun } from '@/shared/contracts/automation'

export const useAiAgentRunActions = ({
  activeTurn,
  adHocTimeoutMs,
  app,
  conversationVersionRef,
  modelIsValid,
  onRunStarted,
  prompt,
  queuedTurn,
  runSequencesRef,
  selectedModel,
  selectedProvider,
  selectedVisionModel,
  selectedVisionProvider,
  setActiveTurnId,
  setError,
  setPrompt,
  setTurns,
  turns
}: {
  activeTurn: ChatTurn | null
  adHocTimeoutMs: number
  app: AppDefinition
  conversationVersionRef: RefObject<number>
  modelIsValid: boolean
  onRunStarted?: (run: AutomationRun) => void
  prompt: string
  queuedTurn: ChatTurn | undefined
  runSequencesRef: RefObject<Map<string, number>>
  selectedModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedProvider: AutomationAiModelCatalogProvider | undefined
  selectedVisionModel: AutomationAiModelCatalogProvider['models'][number] | undefined
  selectedVisionProvider: AutomationAiModelCatalogProvider | undefined
  setActiveTurnId: (turnId: string | null) => void
  setError: (error: string | null) => void
  setPrompt: Dispatch<SetStateAction<string>>
  setTurns: Dispatch<SetStateAction<ChatTurn[]>>
  turns: ChatTurn[]
}) => {
  const [isCanceling, setIsCanceling] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const cancelingRunIdRef = useRef<string | null>(null)

  const startTurn = useCallback(
    async (turn: ChatTurn, conversation: ChatConversationMessage[]) => {
      if (!selectedProvider || !selectedModel) return
      setActiveTurnId(turn.id)
      setError(null)
      setTurns(current =>
        current.map(item => (item.id === turn.id ? { ...item, status: 'starting', error: null } : item))
      )
      try {
        const nextRun = await runAdHocAiAutomationAction({
          targetApplicationId: app.id,
          profileMode: app.profileMode,
          profileName: app.profileName,
          prompt: turn.prompt,
          conversation,
          providerId: selectedProvider.id,
          modelId: selectedModel.id,
          ...(selectedVisionProvider && selectedVisionModel
            ? {
                visionProviderId: selectedVisionProvider.id,
                visionModelId: selectedVisionModel.id
              }
            : {}),
          clientMessageId: turn.id,
          maxToolCalls: 20,
          timeoutMs: adHocTimeoutMs,
          rawShellPolicy: turn.rawShellPolicy ?? 'deny',
          startPolicy: 'require-running'
        })
        setTurns(current =>
          current.map(item =>
            item.id === turn.id
              ? {
                  ...item,
                  status: activeRunStatuses.has(nextRun.status) ? 'running' : (nextRun.status as ChatTurnStatus),
                  run: nextRun
                }
              : item
          )
        )
        onRunStarted?.(nextRun)
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : 'AI automation could not start.'
        setTurns(current =>
          current.map(item => (item.id === turn.id ? { ...item, status: 'failed', error: message } : item))
        )
        setActiveTurnId(null)
        setError(message)
      }
    },
    [
      adHocTimeoutMs,
      app,
      onRunStarted,
      selectedModel,
      selectedProvider,
      selectedVisionModel,
      selectedVisionProvider,
      setActiveTurnId,
      setError,
      setTurns
    ]
  )

  const submitPrompt = async (
    promptText: string,
    options: { rawShellPolicy?: ChatTurn['rawShellPolicy']; clearComposer?: boolean } = {}
  ) => {
    const text = promptText.trim()
    if (!app.running || !text || !modelIsValid) return
    const nextTurn = createPromptTurn({
      id: crypto.randomUUID(),
      prompt: text,
      hasActiveTurn: Boolean(activeTurn),
      rawShellPolicy: options.rawShellPolicy
    })
    setTurns(current => [...current, nextTurn])
    if (options.clearComposer) setPrompt('')
    if (!activeTurn) {
      await startTurn(nextTurn, conversationBeforeTurn(nextTurn.id, turns))
    }
  }

  const submit = async () => {
    await submitPrompt(prompt, { clearComposer: true })
  }

  const runQueuedTurn = async () => {
    if (!app.running || !queuedTurn || activeTurn) return
    await startTurn(queuedTurn, conversationBeforeTurn(queuedTurn.id, turns))
  }

  const canCancelRun =
    activeTurn?.run && activeRunStatuses.has(activeTurn.run.status) && activeTurn.status !== 'canceling'
  const showCancelRun = activeTurn?.run && (canCancelRun || activeTurn.status === 'canceling')

  const cancelRun = async () => {
    if (!activeTurn?.run || !canCancelRun) return
    if (cancelingRunIdRef.current === activeTurn.run.id) return
    cancelingRunIdRef.current = activeTurn.run.id
    const runId = activeTurn.run.id
    const turnId = activeTurn.id
    setIsCanceling(true)
    setError(null)
    setTurns(current => current.map(turn => (turn.id === turnId ? { ...turn, status: 'canceling' } : turn)))
    try {
      const canceled = await cancelAutomationRunAction(runId)
      setTurns(current =>
        current.map(turn =>
          turn.id === turnId
            ? {
                ...turn,
                status: 'canceled',
                run: canceled
              }
            : turn
        )
      )
      setActiveTurnId(null)
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'AI automation could not be canceled.')
    } finally {
      if (cancelingRunIdRef.current === runId) cancelingRunIdRef.current = null
      setIsCanceling(false)
    }
  }

  const clearConversation = async () => {
    if (isClearing) return
    conversationVersionRef.current += 1
    setTurns([])
    setActiveTurnId(null)
    runSequencesRef.current.clear()
    setIsClearing(true)
    setError(null)
    try {
      await clearAdHocAiAutomationRunsAction(app.id)
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'AI conversation could not be cleared.')
    } finally {
      setIsClearing(false)
    }
  }

  return {
    canSubmit: app.running && Boolean(prompt.trim()) && modelIsValid,
    cancelRun,
    clearConversation,
    isCanceling,
    isClearing,
    runQueuedTurn,
    showCancelRun,
    submit,
    submitPrompt
  }
}
