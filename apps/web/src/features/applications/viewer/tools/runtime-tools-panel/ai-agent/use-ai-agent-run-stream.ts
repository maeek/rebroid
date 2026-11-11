import { useEffect } from 'react'
import type { RefObject } from 'react'
import { subscribeToRunEvents } from '@/shared/model/run-event-delivery'
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
    const version = conversationVersionRef.current
    return subscribeToRunEvents({
      runId,
      after: runSequencesRef.current.get(runId),
      isCurrent: () => version === conversationVersionRef.current,
      onEvents: events => appendRunEvents(runId, events)
    })
  }, [runId, appendRunEvents, conversationVersionRef, runSequencesRef])
}
