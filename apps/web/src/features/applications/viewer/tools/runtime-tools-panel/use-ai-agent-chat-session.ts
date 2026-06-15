import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelAutomationRunAction,
  clearAdHocAiAutomationRunsAction,
  createAutomationRunEventStreamUrlAction,
  listAdHocAiAutomationRunHistoryAction,
  listAutomationRunEventsAction,
  runAdHocAiAutomationAction
} from '@/server/orchestrator/automations/automation-run-actions'
import {
  collectLatestRunSequences,
  createPromptTurn,
  findActiveHistoryTurnId,
  findTerminalRunStatus,
  latestEventSequence,
  mergeHistoryTurns,
  mergeRunEventsIntoTurns,
  sortChatTurnsByRunCreatedAt
} from './ai-agent-chat-session-model'
import {
  activeRunStatuses,
  chatTurnFromRun,
  conversationBeforeTurn,
  type ChatConversationMessage,
  type ChatTurn,
  type ChatTurnStatus
} from './ai-agent-chat-utils'
import { useAiAgentModelSettings } from './use-ai-agent-model-settings'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun, AutomationRunEvent } from '@/server/orchestrator/automations/types'

const transcriptAutoScrollThresholdPx = 80

const isTranscriptNearBottom = (element: HTMLDivElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= transcriptAutoScrollThresholdPx

export const useAiAgentChatSession = ({
  app,
  onRunStarted
}: {
  app: AppDefinition
  onRunStarted?: (run: AutomationRun) => void
}) => {
  const [prompt, setPrompt] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const transcriptShouldStickToBottomRef = useRef(true)
  const runSequencesRef = useRef(new Map<string, number>())
  const cancelingRunIdRef = useRef<string | null>(null)
  const conversationVersionRef = useRef(0)
  const {
    adHocTimeoutMinutes,
    adHocTimeoutMs,
    catalog,
    health,
    isCheckingHealth,
    modelIsValid,
    plannerCatalog,
    recheckHealth,
    selectedModel,
    selectedProvider,
    selectedVisionModel,
    selectedVisionProvider,
    selectionMessage,
    setModelId,
    setProviderId,
    setVisionModelId,
    setVisionProviderId,
    setTimeoutMinutesInput,
    timeoutMinutesInput,
    visionCatalog
  } = useAiAgentModelSettings()

  const activeTurn = turns.find(turn => turn.id === activeTurnId) ?? null
  const queuedTurn = turns.find(turn => turn.status === 'queued')

  useEffect(() => {
    let cancelled = false
    const version = conversationVersionRef.current

    const loadHistory = async () => {
      setIsLoadingHistory(true)
      try {
        const history = await listAdHocAiAutomationRunHistoryAction(app.id, 20)
        const loadedTurns = history.map(item => chatTurnFromRun(item.run, item.events))
        if (cancelled || version !== conversationVersionRef.current) return
        const orderedTurns = sortChatTurnsByRunCreatedAt(loadedTurns)
        for (const [runId, sequence] of collectLatestRunSequences(orderedTurns)) {
          runSequencesRef.current.set(runId, sequence)
        }
        setTurns(current => mergeHistoryTurns(current, orderedTurns))
        const loadedActiveTurnId = findActiveHistoryTurnId(orderedTurns)
        if (loadedActiveTurnId) setActiveTurnId(loadedActiveTurnId)
      } catch (historyError) {
        if (cancelled || version !== conversationVersionRef.current) return
        setError(historyError instanceof Error ? historyError.message : 'AI chat history could not be loaded.')
      } finally {
        if (!cancelled && version === conversationVersionRef.current) {
          setIsLoadingHistory(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [app.id])

  const onTranscriptScroll = useCallback(() => {
    const transcript = transcriptRef.current
    transcriptShouldStickToBottomRef.current = transcript ? isTranscriptNearBottom(transcript) : true
  }, [])

  useEffect(() => {
    const transcript = transcriptRef.current
    if (!transcript || !transcriptShouldStickToBottomRef.current) return
    transcript.scrollTo({ top: transcript.scrollHeight, behavior: 'smooth' })
    transcriptShouldStickToBottomRef.current = true
  }, [turns])

  const appendRunEvents = useCallback((runId: string, nextEvents: AutomationRunEvent[]) => {
    if (nextEvents.length === 0) return
    const nextSequence = latestEventSequence(runSequencesRef.current.get(runId) ?? 0, nextEvents)
    runSequencesRef.current.set(runId, nextSequence)
    setTurns(current => mergeRunEventsIntoTurns(current, runId, nextEvents))
    if (findTerminalRunStatus(nextEvents)) {
      setActiveTurnId(null)
    }
  }, [])

  const activeRun = activeTurn?.run ?? null
  useEffect(() => {
    if (!activeRun || !activeRunStatuses.has(activeRun.status)) return
    let closed = false
    let socket: WebSocket | null = null
    const version = conversationVersionRef.current

    const connect = async () => {
      const after = runSequencesRef.current.get(activeRun.id) ?? 0
      runSequencesRef.current.set(activeRun.id, after)
      const initialEvents = await listAutomationRunEventsAction(activeRun.id, after)
      if (closed || version !== conversationVersionRef.current) return
      appendRunEvents(activeRun.id, initialEvents)
      const streamAfter = runSequencesRef.current.get(activeRun.id) ?? after
      const url = await createAutomationRunEventStreamUrlAction(activeRun.id, streamAfter)
      if (closed || version !== conversationVersionRef.current) return
      socket = new WebSocket(url)
      socket.onmessage = event => {
        if (version !== conversationVersionRef.current) return
        const payload = JSON.parse(String(event.data)) as { type: string; event?: AutomationRunEvent }
        if (payload.type === 'event' && payload.event) appendRunEvents(activeRun.id, [payload.event])
      }
      socket.onclose = () => {
        if (!closed && version === conversationVersionRef.current) window.setTimeout(() => void connect(), 1500)
      }
    }

    void connect()
    return () => {
      closed = true
      socket?.close()
    }
  }, [activeRun, appendRunEvents])

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
    [adHocTimeoutMs, app, onRunStarted, selectedModel, selectedProvider, selectedVisionModel, selectedVisionProvider]
  )

  const submit = async () => {
    const text = prompt.trim()
    if (!text || !modelIsValid) return
    const nextTurn = createPromptTurn({ id: crypto.randomUUID(), prompt: text, hasActiveTurn: Boolean(activeTurn) })
    setTurns(current => [...current, nextTurn])
    setPrompt('')
    if (!activeTurn) {
      await startTurn(nextTurn, conversationBeforeTurn(nextTurn.id, turns))
    }
  }

  const runQueuedTurn = async () => {
    if (!queuedTurn || activeTurn) return
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
    activeTurn,
    adHocTimeoutMinutes,
    adHocTimeoutMs,
    canSubmit: Boolean(prompt.trim()) && modelIsValid,
    cancelRun,
    catalog,
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
    onTranscriptScroll,
    transcriptRef,
    turns,
    visionCatalog
  }
}
