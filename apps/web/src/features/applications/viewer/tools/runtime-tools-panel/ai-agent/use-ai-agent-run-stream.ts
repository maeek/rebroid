import { useEffect } from 'react'
import type { RefObject } from 'react'
import {
  createAutomationRunEventStreamUrlAction,
  listAutomationRunEventsAction
} from '@/server/orchestrator/automations/automation-run-actions'
import { findTerminalRunStatus } from './ai-agent-chat-session-model'
import type { AutomationRunEvent } from '@/shared/contracts/automation'

export const useAiAgentRunStream = ({
  runId,
  appendRunEvents,
  conversationVersionRef,
  runSequencesRef
}: {
  runId: string | undefined
  appendRunEvents: (runId: string, events: AutomationRunEvent[]) => void
  conversationVersionRef: RefObject<number>
  runSequencesRef: RefObject<Map<string, number>>
}) => {
  useEffect(() => {
    if (!runId) return
    let closed = false
    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    const version = conversationVersionRef.current

    const isCurrent = () => !closed && version === conversationVersionRef.current
    const reconnect = () => {
      if (isCurrent()) reconnectTimer = window.setTimeout(() => void connect().catch(reconnect), 1500)
    }
    const connect = async () => {
      if (!isCurrent()) return
      const after = runSequencesRef.current.get(runId) ?? 0
      const initialEvents = await listAutomationRunEventsAction(runId, after)
      if (!isCurrent()) return
      appendRunEvents(runId, initialEvents)
      if (findTerminalRunStatus(initialEvents)) return
      const streamAfter = runSequencesRef.current.get(runId) ?? after
      const url = await createAutomationRunEventStreamUrlAction(runId, streamAfter)
      if (!isCurrent()) return
      socket = new WebSocket(url)
      socket.onmessage = event => {
        if (!isCurrent()) return
        const payload = JSON.parse(String(event.data)) as { type: string; event?: AutomationRunEvent }
        if (payload.type === 'event' && payload.event) appendRunEvents(runId, [payload.event])
      }
      socket.onclose = reconnect
    }

    void connect().catch(reconnect)
    return () => {
      closed = true
      window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [runId, appendRunEvents, conversationVersionRef, runSequencesRef])
}
