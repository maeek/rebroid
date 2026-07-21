import { describe, expect, it } from 'vitest'
import { conversationBeforeTurn, currentStreamingText, lastAssistantText } from './ai-agent-conversation'

describe('AI agent conversation', () => {
  it('builds bounded context from completed turns', () => {
    const turns = Array.from({ length: 12 }, (_, index) => ({
      id: `turn-${index}`,
      prompt: `Prompt ${index}`,
      events: [{ type: 'ai.message.completed', message: `Answer ${index}` }]
    }))

    const conversation = conversationBeforeTurn('turn-12', turns)
    expect(conversation).toHaveLength(20)
    expect(conversation[0]).toEqual({ role: 'user', content: 'Prompt 2' })
    expect(conversation.at(-1)).toEqual({ role: 'assistant', content: 'Answer 11' })
  })

  it('separates completed and currently streaming assistant text', () => {
    const turn = {
      prompt: 'Prompt',
      events: [
        { type: 'ai.message.delta', message: 'draft' },
        { type: 'ai.message.completed', message: 'Final' },
        { type: 'ai.message.delta', message: 'Next ' },
        { type: 'ai.message.delta', message: 'draft' }
      ]
    }

    expect(lastAssistantText(turn)).toBe('Final')
    expect(currentStreamingText(turn)).toBe('Next draft')
  })
})
