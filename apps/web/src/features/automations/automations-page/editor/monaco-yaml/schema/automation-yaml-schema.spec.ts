import { describe, expect, it } from '@jest/globals'
import { buildAutomationYamlSchema } from './automation-yaml-schema'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

const commands: AutomationCommand[] = [
  {
    uses: 'android.viewerCommand',
    label: 'Viewer command',
    description: 'Sends a supported viewer control command.',
    requiredPermissions: ['automations:run'],
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: ['back', 'home', 'wake'] }
      },
      required: ['command'],
      additionalProperties: false
    },
    editor: {
      inputDefaults: {},
      inputFieldOrder: ['command'],
      yamlSnippetFields: ['command']
    }
  }
]

describe('automation YAML schema', () => {
  it('includes command-specific input schemas on action steps', () => {
    const schema = buildAutomationYamlSchema(commands)
    const actionStep = stepVariants(schema)[0] as Record<string, unknown>
    const properties = actionStep.properties as Record<string, Record<string, unknown>>
    const withProperties = properties.with.properties as Record<string, Record<string, unknown>>

    expect(properties.uses.enum).toEqual(['android.viewerCommand'])
    expect(withProperties.command.enum).toEqual(['back', 'home', 'wake'])
  })

  it('keeps command defaults on the command input schema', () => {
    const schema = buildAutomationYamlSchema(commands)
    const actionStep = stepVariants(schema)[0] as Record<string, unknown>
    const properties = actionStep.properties as Record<string, Record<string, unknown>>

    expect(properties.with.default).toEqual({})
    expect((schema.definitions as Record<string, Record<string, unknown>>).step.defaultSnippets).toBeUndefined()
  })
})

const stepVariants = (schema: Record<string, unknown>) => {
  const definitions = schema.definitions as Record<string, Record<string, unknown>>
  const step = definitions.step
  return step.oneOf as unknown[]
}
