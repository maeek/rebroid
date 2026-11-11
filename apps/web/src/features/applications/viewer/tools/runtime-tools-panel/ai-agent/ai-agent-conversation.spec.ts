import { describe, expect, it } from 'vitest'
import { conversationBeforeTurn } from './ai-agent-conversation'

describe('AI agent conversation', () => {
  it('builds bounded context from completed turns', () => {
    const turns = Array.from({ length: 12 }, (_, index) => ({
      id: `turn-${index}`,
      status: 'success' as const,
      prompt: `Prompt ${index}`,
      events: [{ type: 'ai.message.completed', message: `Answer ${index}` }]
    }))

    const conversation = conversationBeforeTurn('turn-12', turns)
    expect(conversation).toHaveLength(20)
    expect(conversation[0]).toEqual({ role: 'user', content: 'Prompt 2' })
    expect(conversation.at(-1)).toEqual({ role: 'assistant', content: 'Answer 11' })
  })

  it('omits queued prompts from conversation history', () => {
    const turns = [
      { id: 'done', status: 'success', prompt: 'Open settings', events: [] },
      { id: 'queued', status: 'queued', prompt: 'Change brightness', events: [] }
    ] as const

    expect(conversationBeforeTurn('suggestions', turns)).toEqual([{ role: 'user', content: 'Open settings' }])
  })
})
