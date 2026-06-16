import { useCallback, useEffect, useRef } from 'react'
import type { ChatTurn } from './ai-agent-chat-utils'

const transcriptAutoScrollThresholdPx = 80

const isTranscriptNearBottom = (element: HTMLDivElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= transcriptAutoScrollThresholdPx

export const useAiAgentTranscriptScroll = (turns: ChatTurn[]) => {
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const transcriptShouldStickToBottomRef = useRef(true)

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

  return { onTranscriptScroll, transcriptRef }
}
