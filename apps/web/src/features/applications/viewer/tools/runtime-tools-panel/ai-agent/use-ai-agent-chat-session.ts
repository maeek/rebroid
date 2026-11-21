import { useCallback, useRef, useState } from 'react'
import { findActiveChatTurn, latestEventSequence, mergeRunEventsIntoTurns } from './ai-agent-chat-session-model'
import { type ChatTurn } from './ai-agent-chat-utils'
import { useAiAgentHistory } from './use-ai-agent-history'
import { useAiAgentModelSettings } from './use-ai-agent-model-settings'
import { useAiAgentRunActions } from './use-ai-agent-run-actions'
import { useAiAgentRunStream } from './use-ai-agent-run-stream'
import { useAiAgentTranscriptScroll } from './use-ai-agent-transcript-scroll'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun, AutomationRunEvent } from '@/shared/contracts/automation'

export const useAiAgentChatSession = ({
  app,
  onRunStarted
}: {
  app: AppDefinition
  onRunStarted?: (run: AutomationRun) => void
}) => {
  const [prompt, setPrompt] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [error, setError] = useState<string | null>(null)
  const runSequencesRef = useRef(new Map<string, number>())
  const conversationVersionRef = useRef(0)
  const { modelIsValid, ...modelSettings } = useAiAgentModelSettings()
  const { adHocTimeoutMs, selectedModel, selectedProvider, selectedVisionModel, selectedVisionProvider } = modelSettings

  const activeTurn = findActiveChatTurn(turns)
  const queuedTurn = turns.find(turn => turn.status === 'queued')

  const { historyStatus, retryHistory } = useAiAgentHistory({
    appId: app.id,
    conversationVersionRef,
    runSequencesRef,
    setTurns
  })
  const transcriptScroll = useAiAgentTranscriptScroll(turns)

  const appendRunEvents = useCallback((runId: string, nextEvents: AutomationRunEvent[]) => {
    if (nextEvents.length === 0) return
    const nextSequence = latestEventSequence(runSequencesRef.current.get(runId) ?? 0, nextEvents)
    runSequencesRef.current.set(runId, nextSequence)
    setTurns(current => mergeRunEventsIntoTurns(current, runId, nextEvents))
  }, [])

  useAiAgentRunStream({ runId: activeTurn?.run?.id, appendRunEvents, conversationVersionRef, runSequencesRef })
  const actions = useAiAgentRunActions({
    activeTurn,
    adHocTimeoutMs,
    appendRunEvents,
    app,
    conversationVersionRef,
    historyReady: historyStatus === 'ready',
    modelIsValid,
    onRunStarted,
    prompt,
    reloadHistory: retryHistory,
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
  })

  return {
    ...actions,
    ...transcriptScroll,
    activeTurn,
    error,
    isLoadingHistory: historyStatus === 'loading',
    historyLoadFailed: historyStatus === 'failed',
    modelSettings,
    prompt,
    queuedTurn,
    retryHistory,
    setPrompt,
    turns
  }
}
