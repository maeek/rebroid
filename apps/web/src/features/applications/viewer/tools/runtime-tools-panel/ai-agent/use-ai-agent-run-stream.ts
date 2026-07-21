import { useEffect } from 'react'
import type { RefObject } from 'react'
import {
  createAutomationRunEventStreamUrlAction,
  listAutomationRunEventsAction
} from '@/server/orchestrator/automations/automation-run-actions'
import { activeRunStatuses } from './ai-agent-chat-utils'
import type { AutomationRun, AutomationRunEvent } from '@/shared/contracts/automation'

export const useAiAgentRunStream = ({
  activeRun,
  appendRunEvents,
  conversationVersionRef,
  runSequencesRef
}: {
  activeRun: AutomationRun | null
  appendRunEvents: (runId: string, events: AutomationRunEvent[]) => void
  conversationVersionRef: RefObject<number>
  runSequencesRef: RefObject<Map<string, number>>
}) => {
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
  }, [activeRun, appendRunEvents, conversationVersionRef, runSequencesRef])
}
