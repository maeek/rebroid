import { useCallback, useRef, useState } from 'react'
import { findTerminalRunStatus, latestEventSequence, mergeRunEventsIntoTurns } from './ai-agent-chat-session-model'
import { type ChatTurn } from './ai-agent-chat-utils'
import { useAiAgentHistory } from './use-ai-agent-history'
import { useAiAgentModelSettings } from './use-ai-agent-model-settings'
import { useAiAgentRunActions } from './use-ai-agent-run-actions'
import { useAiAgentRunStream } from './use-ai-agent-run-stream'
import { useAiAgentTranscriptScroll } from './use-ai-agent-transcript-scroll'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun, AutomationRunEvent } from '@/server/orchestrator/automations/types'

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
  const [error, setError] = useState<string | null>(null)
  const runSequencesRef = useRef(new Map<string, number>())
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

  const isLoadingHistory = useAiAgentHistory({
    appId: app.id,
    conversationVersionRef,
    runSequencesRef,
    setActiveTurnId,
    setError,
    setTurns
  })
  const { onTranscriptScroll, transcriptRef } = useAiAgentTranscriptScroll(turns)

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
  useAiAgentRunStream({ activeRun, appendRunEvents, conversationVersionRef, runSequencesRef })
  const {
    canSubmit,
    cancelRun,
    clearConversation,
    isCanceling,
    isClearing,
    runQueuedTurn,
    showCancelRun,
    submit,
    submitPrompt
  } = useAiAgentRunActions({
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
  })

  return {
    activeTurn,
    adHocTimeoutMinutes,
    adHocTimeoutMs,
    canSubmit,
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
    submitPrompt,
    timeoutMinutesInput,
    onTranscriptScroll,
    transcriptRef,
    turns,
    visionCatalog
  }
}
