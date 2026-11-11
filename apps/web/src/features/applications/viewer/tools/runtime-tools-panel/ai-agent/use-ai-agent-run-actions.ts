import { useCallback, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import {
  cancelAutomationRunAction,
  clearAdHocAiAutomationRunsAction,
  runAdHocAiAutomationAction
} from '@/server/orchestrator/automations/automation-run-actions'
import { replayTerminalRunEvents } from '@/shared/model/run-event-delivery'
import { createPromptTurn } from './ai-agent-chat-session-model'
import { activeRunStatuses, runStatusToTurnStatus, terminalRunStatuses, type ChatTurn } from './ai-agent-chat-utils'
import { conversationBeforeTurn, type AutomationAiConversationMessage } from './ai-agent-conversation'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'
import type { AutomationRun, AutomationRunEvent } from '@/shared/contracts/automation'

type AppendRunEvents = (runId: string, events: AutomationRunEvent[]) => void

export const useAiAgentRunActions = ({
  activeTurn,
  adHocTimeoutMs,
  appendRunEvents,
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
  setError,
  setPrompt,
  setTurns,
  turns
}: {
  activeTurn: ChatTurn | null
  adHocTimeoutMs: number
  appendRunEvents: AppendRunEvents
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
  setError: (error: string | null) => void
  setPrompt: Dispatch<SetStateAction<string>>
  setTurns: Dispatch<SetStateAction<ChatTurn[]>>
  turns: ChatTurn[]
}) => {
  const [isCanceling, setIsCanceling] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const pendingStart = useRef<Promise<AutomationRun> | null>(null)
  const clearing = useRef(false)
  const cancelingRunIdRef = useRef<string | null>(null)

  const startTurn = useCallback(
    async (turn: ChatTurn, conversation: AutomationAiConversationMessage[]) => {
      if (!selectedProvider || !selectedModel || pendingStart.current || clearing.current) return
      const version = conversationVersionRef.current
      setError(null)
      setTurns(current =>
        current.map(item => (item.id === turn.id ? { ...item, status: 'starting', error: null } : item))
      )
      try {
        pendingStart.current = runAdHocAiAutomationAction({
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
          maxActions: 20,
          timeoutMs: adHocTimeoutMs,
          rawShellPolicy: turn.rawShellPolicy ?? 'deny',
          startPolicy: 'require-running'
        })
        const nextRun = await pendingStart.current
        if (version !== conversationVersionRef.current) return
        setTurns(current =>
          current.map(item =>
            item.id === turn.id && !item.run
              ? {
                  ...item,
                  status: runStatusToTurnStatus(nextRun.status),
                  run: nextRun
                }
              : item
          )
        )
        onRunStarted?.(nextRun)
      } catch (submitError) {
        if (version !== conversationVersionRef.current) return
        const message = submitError instanceof Error ? submitError.message : 'AI automation could not start.'
        setTurns(current =>
          current.map(item => (item.id === turn.id ? { ...item, status: 'failed', error: message } : item))
        )
        setError(message)
      } finally {
        pendingStart.current = null
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
      conversationVersionRef,
      setError,
      setTurns
    ]
  )

  const submitPrompt = async (
    promptText: string,
    options: { rawShellPolicy?: ChatTurn['rawShellPolicy']; clearComposer?: boolean } = {}
  ) => {
    const text = promptText.trim()
    if (!app.running || !text || !modelIsValid || clearing.current) return
    const shouldQueue = Boolean(activeTurn || queuedTurn || pendingStart.current)
    const nextTurn = createPromptTurn({
      id: crypto.randomUUID(),
      prompt: text,
      shouldQueue,
      rawShellPolicy: options.rawShellPolicy
    })
    setTurns(current => [...current, nextTurn])
    if (options.clearComposer) setPrompt('')
    if (!shouldQueue) {
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
    const version = conversationVersionRef.current
    const after = runSequencesRef.current.get(runId) ?? 0
    const isCurrent = () => version === conversationVersionRef.current
    const turnId = activeTurn.id
    setIsCanceling(true)
    setError(null)
    setTurns(current => current.map(turn => (turn.id === turnId ? { ...turn, status: 'canceling' } : turn)))
    try {
      const canceled = await cancelAutomationRunAction(runId)
      if (!isCurrent()) return
      const terminal = terminalRunStatuses.has(canceled.status)
      if (terminal) {
        // Catch up before the terminal status detaches the subscription.
        await replayTerminalRunEvents({ runId, after, onEvents: events => appendRunEvents(runId, events), isCurrent })
        if (!isCurrent()) return
      }
      setTurns(current =>
        current.map(turn =>
          turn.run?.id === runId && (turn.status === 'canceling' || terminal)
            ? {
                ...turn,
                status: runStatusToTurnStatus(canceled.status),
                run: canceled
              }
            : turn
        )
      )
    } catch (cancelError) {
      if (!isCurrent()) return
      setTurns(current =>
        current.map(turn => (turn.id === turnId && turn.status === 'canceling' ? { ...turn, status: 'running' } : turn))
      )
      setError(cancelError instanceof Error ? cancelError.message : 'AI automation could not be canceled.')
    } finally {
      if (cancelingRunIdRef.current === runId) {
        cancelingRunIdRef.current = null
        setIsCanceling(false)
      }
    }
  }

  const clearConversation = async () => {
    if (clearing.current) return
    clearing.current = true
    conversationVersionRef.current += 1
    setTurns([])
    runSequencesRef.current.clear()
    setIsClearing(true)
    setError(null)
    try {
      await pendingStart.current?.catch(() => undefined)
      await clearAdHocAiAutomationRunsAction(app.id)
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'AI conversation could not be cleared.')
    } finally {
      clearing.current = false
      setIsClearing(false)
    }
  }

  return {
    canSubmit: app.running && Boolean(prompt.trim()) && modelIsValid && !isClearing,
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
