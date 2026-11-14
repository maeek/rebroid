import { useFollowOutput } from '@/hooks/use-follow-output'
import type { ChatTurn } from './ai-agent-chat-utils'

export const useAiAgentTranscriptScroll = (turns: ChatTurn[]) => {
  const { outputRef, onScroll, isAtBottom, scrollToLatest } = useFollowOutput<HTMLDivElement>(turns)
  return { transcriptRef: outputRef, onTranscriptScroll: onScroll, isAtBottom, scrollToLatest }
}
