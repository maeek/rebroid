import { describe, expect, it } from 'vitest'
import { recommendAiModelForAutomation } from './ai-model-recommendation'

describe('AI model recommendations', () => {
  it('recognizes GUI-oriented vision models', () => {
    expect(
      recommendAiModelForAutomation({
        id: 'qwen2.5-vl:7b',
        label: 'Qwen2.5 VL 7B',
        roles: ['planner', 'vision']
      })
    ).toMatchObject({ level: 'good', title: 'GUI-oriented' })
  })

  it('warns about general vision-language models used for GUI control', () => {
    expect(
      recommendAiModelForAutomation({
        id: 'gemma4:e4b-mlx',
        label: 'Gemma 4',
        roles: ['planner', 'vision']
      }).level
    ).toBe('warning')
  })
})
