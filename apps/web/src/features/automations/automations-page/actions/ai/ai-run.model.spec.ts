import { describe, expect, it } from 'vitest'
import {
  defaultAiRunCapabilities,
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

  it('shows permitted defaults and keeps explicit edits distinct from default selection', () => {
    const commands = selectableAiRunCommands([
      command('ai.run'),
      command('android.adbShell'),
      command('android.tap'),
      command('android.tapText'),
      command('android.wait'),
      command('android.getClipboard'),
      command('android.waitForText'),
      { ...command('android.getSetting'), permitted: false }
    ])

    expect(commands.map(item => item.uses)).toEqual([
      'android.getClipboard',
      'android.getSetting',
      'android.wait',
      'android.waitForText'
    ])
    expect(defaultAiRunCapabilities(commands)).toEqual(['android.getClipboard', 'android.wait'])
    expect(nextAiRunCapabilities({ capabilities: undefined, commands, uses: 'android.wait', enabled: false })).toEqual([
      'android.getClipboard'
    ])
    expect(
      nextAiRunCapabilities({ capabilities: ['android.getClipboard'], commands, uses: 'android.wait', enabled: true })
    ).toEqual(['android.getClipboard', 'android.wait'])
    expect(
      nextAiRunCapabilities({ capabilities: ['android.wait'], commands, uses: 'android.wait', enabled: false })
    ).toEqual([])
    expect(normalizeAiRunInput({ capabilities: [] }).capabilities).toEqual([])
  })

  it('labels provider health states for compact UI display', () => {
    expect(healthLabel({ status: 'ok' } as AutomationAiProviderHealth)).toBe('Online')
    expect(healthLabel({ status: 'disabled' } as AutomationAiProviderHealth)).toBe('Disabled')
    expect(healthLabel({ status: 'error' } as AutomationAiProviderHealth)).toBe('Error')
  })
})
