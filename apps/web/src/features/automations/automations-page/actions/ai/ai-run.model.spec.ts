import { describe, expect, it } from 'vitest'
import {
  defaultAiRunInput,
  healthLabel,
  nextAiRunCapabilities,
  normalizeAiRunInput,
  selectableAiRunCommands,
  summarizeAiRunInput
} from './ai-run.model'
import type { AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'
import type { AutomationCommand } from '@/shared/contracts/automation'

const command = (uses: string): AutomationCommand => ({
  uses,
  label: uses,
  description: '',
  requiredPermissions: [],
  inputSchema: {},
  outputs: [],
  editor: {
    inputDefaults: {},
    inputFieldOrder: [],
    yamlSnippetFields: []
  }
})

describe('ai run action model', () => {
  it('provides stable defaults and normalizes bounded backend input', () => {
    expect(defaultAiRunInput()).toEqual({
      prompt: 'Inspect the screen and complete the requested task.',
      maxActions: 20,
      timeoutMs: 120000
    })

    expect(
      normalizeAiRunInput({
        prompt: '',
        providerId: 'local',
        modelId: 'qwen',
        visionProviderId: 10,
        capabilities: ['android.tap', 7, 'android.swipe'],
        maxActions: 200,
        timeoutMs: 100
      })
    ).toEqual({
      prompt: 'Inspect the screen and complete the requested task.',
      providerId: 'local',
      modelId: 'qwen',
      capabilities: ['android.tap', 'android.swipe'],
      maxActions: 100,
      timeoutMs: 1000
    })
  })

  it('summarizes planner, vision, timeout, and action limits', () => {
    expect(
      summarizeAiRunInput({
        prompt: 'Inspect the current display',
        providerId: 'planner-provider',
        modelId: 'planner-model',
        visionProviderId: 'vision-provider',
        visionModelId: 'vision-model',
        maxActions: 7,
        timeoutMs: 45000
      })
    ).toBe(
      'Inspect the current display · device control planner-provider/planner-model · vision vision-provider/vision-model · 45s · 7 actions'
    )
  })

  it('uses the default when every capability is selected and preserves explicit empty selections', () => {
    const commands = selectableAiRunCommands([command('ai.run'), command('android.swipe'), command('android.tap')])

    expect(commands.map(item => item.uses)).toEqual(['android.swipe', 'android.tap'])
    expect(nextAiRunCapabilities({ capabilities: undefined, commands, uses: 'android.tap', enabled: false })).toEqual([
      'android.swipe'
    ])
    expect(
      nextAiRunCapabilities({ capabilities: ['android.swipe'], commands, uses: 'android.tap', enabled: true })
    ).toBeUndefined()
    expect(
      nextAiRunCapabilities({ capabilities: ['android.swipe'], commands, uses: 'android.swipe', enabled: false })
    ).toEqual([])
    expect(normalizeAiRunInput({ capabilities: [] }).capabilities).toEqual([])
  })

  it('labels provider health states for compact UI display', () => {
    expect(healthLabel({ status: 'ok' } as AutomationAiProviderHealth)).toBe('Online')
    expect(healthLabel({ status: 'disabled' } as AutomationAiProviderHealth)).toBe('Disabled')
    expect(healthLabel({ status: 'error' } as AutomationAiProviderHealth)).toBe('Error')
  })
})
