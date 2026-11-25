import { useEffect, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { listAdHocAiAutomationRunHistoryAction } from '@/server/orchestrator/automations/automation-run-actions'
import {
  collectLatestRunSequences,
  mergeHistoryTurns,
  sortChatTurnsByRunCreatedAt
} from './ai-agent-chat-session-model'
import { chatTurnFromRun, type ChatTurn } from './ai-agent-chat-utils'

export const useAiAgentHistory = ({
  appId,
  attachmentId,
  conversationVersionRef,
  runSequencesRef,
  setTurns
}: {
  appId: string
  attachmentId?: string
  conversationVersionRef: RefObject<number>
  runSequencesRef: RefObject<Map<string, number>>
  setTurns: Dispatch<SetStateAction<ChatTurn[]>>
}) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)

  const retryHistory = () => {
    setStatus('loading')
    setAttempt(current => current + 1)
  }

  useEffect(() => {
    let cancelled = false
    const version = conversationVersionRef.current

    const loadHistory = async () => {
      setStatus('loading')
      try {
        const history = attachmentId
          ? await listAdHocAiAutomationRunHistoryAction(appId, 20, attachmentId)
          : await listAdHocAiAutomationRunHistoryAction(appId, 20)
        const loadedTurns = history.map(item => chatTurnFromRun(item.run, item.events))
        if (cancelled || version !== conversationVersionRef.current) return
        const orderedTurns = sortChatTurnsByRunCreatedAt(loadedTurns)
        for (const [runId, sequence] of collectLatestRunSequences(orderedTurns)) {
          runSequencesRef.current.set(runId, Math.max(sequence, runSequencesRef.current.get(runId) ?? 0))
        }
        setTurns(current => mergeHistoryTurns(current, orderedTurns))
        setStatus('ready')
      } catch {
        if (cancelled || version !== conversationVersionRef.current) return
        setStatus('failed')
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [appId, attachmentId, attempt, conversationVersionRef, runSequencesRef, setTurns])

  return { historyStatus: status, retryHistory }
}
