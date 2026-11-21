import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useConfirmedFeedback } from '@/hooks/use-confirmed-feedback'
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
  historyReady,
  modelIsValid,
  onRunStarted,
  prompt,
  queuedTurn,
  reloadHistory,
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
  historyReady: boolean
  modelIsValid: boolean
  onRunStarted?: (run: AutomationRun) => void
  prompt: string
  queuedTurn: ChatTurn | undefined
  reloadHistory: () => void
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
  const submission = useConfirmedFeedback<string>()
  const submissionVersion = useRef(0)
  const [isCanceling, setIsCanceling] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const pendingStart = useRef<Promise<AutomationRun> | null>(null)
  const waitingStart = useRef<{
    id: string
    version: number
    draft?: string
    profileMode: AppDefinition['profileMode']
    profileName: AppDefinition['profileName']
  } | null>(null)
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
        return true
      } catch (submitError) {
        if (version !== conversationVersionRef.current) return
        const message = submitError instanceof Error ? submitError.message : 'AI automation could not start.'
        setTurns(current =>
          current.map(item => (item.id === turn.id ? { ...item, status: 'failed', error: message } : item))
        )
        setError(message)
        return false
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

  const sendTurn = async (turn: ChatTurn, version: number, draft?: string) => {
    const accepted = await startTurn(turn, conversationBeforeTurn(turn.id, turns))
    if (version !== submissionVersion.current) return
    if (accepted) submission.confirm('Message sent')
    else if (accepted === false && draft !== undefined) setPrompt(current => current || draft)
  }

  const waitingTurn = turns.find(turn => turn.status === 'waiting-for-history')
  const resumeSend = useEffectEvent(() => {
    const waiting = waitingStart.current
    if (!waiting || waitingTurn?.id !== waiting.id || clearing.current) return
    waitingStart.current = null
    const profileChanged = waiting.profileMode !== app.profileMode || waiting.profileName !== app.profileName
    if (activeTurn || pendingStart.current || !app.running || !modelIsValid || profileChanged) {
      setTurns(current => current.map(turn => (turn.id === waiting.id ? { ...turn, status: 'queued' } : turn)))
      return
    }
    void sendTurn(waitingTurn, waiting.version, waiting.draft)
  })

  useEffect(() => {
    if (historyReady && waitingTurn) resumeSend()
  }, [historyReady, waitingTurn])

  const submitPrompt = async (
    promptText: string,
    options: { rawShellPolicy?: ChatTurn['rawShellPolicy']; clearComposer?: boolean } = {}
  ) => {
    const text = promptText.trim()
    if (!app.running || !text || !modelIsValid || clearing.current) return
    submission.reset()
    const version = ++submissionVersion.current
    const shouldQueue = Boolean(activeTurn || queuedTurn || pendingStart.current || waitingStart.current)
    let status: ChatTurn['status'] = 'starting'
    if (shouldQueue) status = 'queued'
    else if (!historyReady) status = 'waiting-for-history'
    const nextTurn = createPromptTurn({
      id: crypto.randomUUID(),
      prompt: text,
      status,
      rawShellPolicy: options.rawShellPolicy
    })
    const draft = options.clearComposer ? promptText : undefined
    if (status === 'waiting-for-history') {
      waitingStart.current = {
        id: nextTurn.id,
        version,
        draft,
        profileMode: app.profileMode,
        profileName: app.profileName
      }
    }
    setTurns(current => [...current, nextTurn])
    if (options.clearComposer) setPrompt('')
    if (status === 'starting') await sendTurn(nextTurn, version, draft)
    if (status === 'queued') submission.confirm('Task queued')
  }

  const submit = async () => {
    await submitPrompt(prompt, { clearComposer: true })
  }

  const canRunQueuedTurn =
    historyReady && app.running && modelIsValid && !isClearing && !activeTurn && !waitingTurn && Boolean(queuedTurn)
  const runQueuedTurn = async () => {
    if (!canRunQueuedTurn || !queuedTurn) return
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
    waitingStart.current = null
    submissionVersion.current += 1
    submission.reset()
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
      if (!historyReady) reloadHistory()
    }
  }

  return {
    submissionFeedback: submission.confirmation,
    canSubmit: app.running && Boolean(prompt.trim()) && modelIsValid && !isClearing,
    canRunQueuedTurn,
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
