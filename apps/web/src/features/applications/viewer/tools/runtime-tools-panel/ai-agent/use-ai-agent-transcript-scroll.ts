import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatTurn } from './ai-agent-chat-utils'

const transcriptAutoScrollThresholdPx = 80

const isTranscriptNearBottom = (element: HTMLDivElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= transcriptAutoScrollThresholdPx

export const useAiAgentTranscriptScroll = (turns: ChatTurn[]) => {
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const transcriptShouldStickToBottomRef = useRef(true)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const onTranscriptScroll = useCallback(() => {
    const transcript = transcriptRef.current
    transcriptShouldStickToBottomRef.current = transcript ? isTranscriptNearBottom(transcript) : true
    setIsAtBottom(transcriptShouldStickToBottomRef.current)
  }, [])

  const scrollToLatest = useCallback(() => {
    const transcript = transcriptRef.current
    transcript?.scrollTo({ top: transcript.scrollHeight, behavior: 'instant' })
    transcriptShouldStickToBottomRef.current = true
    setIsAtBottom(true)
  }, [])

  useEffect(() => {
    const transcript = transcriptRef.current
    if (!transcript || !transcriptShouldStickToBottomRef.current) return
    transcript.scrollTo({ top: transcript.scrollHeight, behavior: 'instant' })
    transcriptShouldStickToBottomRef.current = true
  }, [turns])

  return { isAtBottom, onTranscriptScroll, scrollToLatest, transcriptRef }
}
