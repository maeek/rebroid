import { describe, expect, it } from '@jest/globals'
import { normalizeProviderForm } from './provider-utils'
import type { AutomationAiProvider } from '@/server/orchestrator/settings/types'

const provider: AutomationAiProvider = {
  id: ' local ',
  label: ' ',
  kind: 'ollama',
  baseUrl: 'http://localhost:11434///',
  apiKey: ' secret ',
  enabled: true,
  models: [
    {
      id: ' qwen ',
      label: ' ',
      supportsVision: true,
      supportsTools: true,
      enabled: true,
      default: true
    },
    {
      id: ' ',
      label: 'Ignored',
      supportsVision: false,
      supportsTools: false,
      enabled: false,
      default: false
    }
  ]
}

describe('provider utils', () => {
  it('normalizes provider and model input', () => {
    expect(normalizeProviderForm(provider)).toEqual({
      ...provider,
      id: 'local',
      label: 'local',
      baseUrl: 'http://localhost:11434',
      apiKey: 'secret',
      models: [
        {
          ...provider.models[0],
          id: 'qwen',
          label: 'qwen',
          supportsVision: false,
          supportsTools: true
        }
      ]
    })
  })
})
