import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { buildYaml, definitionToForm } from '../../editor/builder-utils'
import { parseStepInput } from '../../steps/shared/automation-step-utils'
import {
  defaultAiRunCapabilities,
  defaultAiRunInput,
  healthLabel,
  nextAiRunCapabilities,
  selectableAiRunCommands,
  summarizeAiRunInput
} from './ai-run.model'
import type { AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'
import type { AutomationCommand } from '@/shared/contracts/automation'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

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
  it('provides stable defaults for a new step', () => {
    expect(defaultAiRunInput()).toEqual({
      prompt: 'Inspect the screen and complete the requested task.',
      maxActions: 20,
      timeoutMs: 120000
    })
  })

  it('preserves the complete AI input through a visual prompt edit and YAML serialization', () => {
    const definition = parse(`
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Open Żappka
spec:
  steps:
    - id: open
      uses: ai.run
      with:
        prompt: Open Żappka
        conversation:
          - role: user
            content: Use the launcher
        clientMessageId: message-1
        providerId: local
        modelId: controller-model
        visionProviderId: separate
        visionModelId: vision-model
        maxActions: 7
        timeoutMs: 45000
        capabilities: []
        agentMode: planned
        rawShellPolicy: allowlisted
`) as AutomationDefinition
    const form = definitionToForm(definition)
    const step = form.steps[0]
    const original = definition.spec.steps[0]
    if (step?.kind !== 'action' || !original || !('with' in original)) throw new Error('Expected an action')
    const prompt = 'Open Żappka and verify the app is visible'
    step.withJson = JSON.stringify({ ...parseStepInput(step), prompt })

    expect(parse(buildYaml(form)) as unknown).toMatchObject({
      spec: { steps: [{ with: { ...original.with, prompt } }] }
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
      command('flow.stop'),
      command('vision.locate')
    ])

    expect(commands.map(item => item.uses)).toEqual(['android.getClipboard', 'android.wait', 'vision.locate'])
    expect(defaultAiRunCapabilities(commands)).toEqual(['android.getClipboard', 'android.wait', 'vision.locate'])
    expect(nextAiRunCapabilities({ capabilities: undefined, commands, uses: 'android.wait', enabled: false })).toEqual([
      'android.getClipboard',
      'vision.locate'
    ])
    expect(
      nextAiRunCapabilities({ capabilities: ['android.getClipboard'], commands, uses: 'android.wait', enabled: true })
    ).toEqual(['android.getClipboard', 'android.wait'])
    expect(
      nextAiRunCapabilities({ capabilities: ['android.wait'], commands, uses: 'android.wait', enabled: false })
    ).toEqual([])
  })

  it('labels provider health states for compact UI display', () => {
    expect(healthLabel({ status: 'ok' } as AutomationAiProviderHealth)).toBe('Online')
    expect(healthLabel({ status: 'disabled' } as AutomationAiProviderHealth)).toBe('Disabled')
    expect(healthLabel({ status: 'error' } as AutomationAiProviderHealth)).toBe('Error')
  })
})
