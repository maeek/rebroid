import { useEffect, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { listAdHocAiAutomationRunHistoryAction } from '@/server/orchestrator/automations/automation-run-actions'
import {
  collectLatestRunSequences,
  findActiveHistoryTurnId,
  mergeHistoryTurns,
  sortChatTurnsByRunCreatedAt
} from './ai-agent-chat-session-model'
import { chatTurnFromRun, type ChatTurn } from './ai-agent-chat-utils'

export const useAiAgentHistory = ({
  appId,
  conversationVersionRef,
  runSequencesRef,
  setActiveTurnId,
  setError,
  setTurns
}: {
  appId: string
  conversationVersionRef: RefObject<number>
  runSequencesRef: RefObject<Map<string, number>>
  setActiveTurnId: (turnId: string | null) => void
  setError: (error: string | null) => void
  setTurns: Dispatch<SetStateAction<ChatTurn[]>>
}) => {
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  useEffect(() => {
    let cancelled = false
    const version = conversationVersionRef.current

    const loadHistory = async () => {
      setIsLoadingHistory(true)
      try {
        const history = await listAdHocAiAutomationRunHistoryAction(appId, 20)
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
  }, [appId, conversationVersionRef, runSequencesRef, setActiveTurnId, setError, setTurns])

  return isLoadingHistory
}
