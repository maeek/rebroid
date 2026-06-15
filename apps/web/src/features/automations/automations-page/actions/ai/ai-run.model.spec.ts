import { describe, expect, it } from '@jest/globals'
import {
  buildAiRunCatalogPatch,
  defaultAiRunInput,
  healthLabel,
  nextAllowedAiRunTools,
  normalizeAiRunInput,
  selectableAiRunCommands,
  summarizeAiRunInput
} from './ai-run.model'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

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

const provider = (
  id: string,
  roles: Array<'planner' | 'vision'>,
  modelId: string,
  isDefault = false
): AutomationAiModelCatalogProvider => ({
  id,
  label: id,
  kind: 'ollama',
  models: [
    {
      id: modelId,
      label: modelId,
      roles,
      settings: {},
      enabled: true,
      defaultFor: isDefault ? roles : []
    }
  ]
})

describe('ai run action model', () => {
  it('provides stable defaults and normalizes bounded backend input', () => {
    expect(defaultAiRunInput()).toEqual({
      prompt: 'Inspect the screen and complete the requested task.',
      maxToolCalls: 20,
      timeoutMs: 120000,
      requireFinalAnswer: true
    })

    expect(
      normalizeAiRunInput({
        prompt: '',
        providerId: 'local',
        modelId: 'qwen',
        visionProviderId: 10,
        allowedTools: ['android.tap', 7, 'android.swipe'],
        maxToolCalls: 200,
        timeoutMs: 100,
        requireFinalAnswer: false
      })
    ).toEqual({
      prompt: 'Inspect the screen and complete the requested task.',
      providerId: 'local',
      modelId: 'qwen',
      allowedTools: ['android.tap', 'android.swipe'],
      maxToolCalls: 100,
      timeoutMs: 1000,
      requireFinalAnswer: false
    })
  })

  it('summarizes planner, vision, timeout, and tool-call choices', () => {
    expect(
      summarizeAiRunInput({
        prompt: 'Inspect the current display',
        providerId: 'planner-provider',
        modelId: 'planner-model',
        visionProviderId: 'vision-provider',
        visionModelId: 'vision-model',
        maxToolCalls: 7,
        timeoutMs: 45000
      })
    ).toBe(
      'Inspect the current display · planner planner-provider/planner-model · vision vision-provider/vision-model · 45s · 7 calls'
    )
  })

  it('derives catalog patches for missing planner and vision selections', () => {
    const patch = buildAiRunCatalogPatch({
      catalog: [
        provider('planner-provider', ['planner'], 'planner-default', true),
        provider('vision-provider', ['vision'], 'vision-default', true)
      ],
      providerId: '',
      modelId: '',
      visionProviderId: '',
      visionModelId: ''
    })

    expect(patch).toEqual({
      providerId: 'planner-provider',
      modelId: 'planner-default',
      visionProviderId: 'vision-provider',
      visionModelId: 'vision-default'
    })
  })

  it('selects all commands by empty allowlist and stores only partial selections', () => {
    const commands = selectableAiRunCommands([command('ai.run'), command('android.swipe'), command('android.tap')])

    expect(commands.map(item => item.uses)).toEqual(['android.swipe', 'android.tap'])
    expect(nextAllowedAiRunTools({ allowedTools: [], commands, uses: 'android.tap', enabled: false })).toEqual([
      'android.swipe'
    ])
    expect(
      nextAllowedAiRunTools({ allowedTools: ['android.swipe'], commands, uses: 'android.tap', enabled: true })
    ).toEqual([])
  })

  it('labels provider health states for compact UI display', () => {
    expect(healthLabel({ status: 'ok' } as AutomationAiProviderHealth)).toBe('Online')
    expect(healthLabel({ status: 'disabled' } as AutomationAiProviderHealth)).toBe('Disabled')
    expect(healthLabel({ status: 'error' } as AutomationAiProviderHealth)).toBe('Error')
  })
})
